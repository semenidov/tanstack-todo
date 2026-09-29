import { db } from '#/db';
import { boards, cards, lists } from '#/db/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

const DEFAULT_LIST_TITLES = ['To do', 'Done'];

function ownedBoardIds(userId: string) {
    return db
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.ownerId, userId));
}

function ownedListIds(userId: string) {
    return db
        .select({ id: lists.id })
        .from(lists)
        .innerJoin(boards, eq(lists.boardId, boards.id))
        .where(eq(boards.ownerId, userId));
}

// Column references are spelled out: drizzle drops table qualifiers inside
// `sql` in a single-table select, which makes `id` ambiguous in subqueries.
const listCount = sql<number>`(
    select count(*) from "lists" where "lists"."board_id" = "boards"."id"
)`.mapWith(Number);

const cardCount = sql<number>`(
    select count(*) from "cards"
    inner join "lists" on "cards"."list_id" = "lists"."id"
    where "lists"."board_id" = "boards"."id"
)`.mapWith(Number);

export function listBoards(userId: string) {
    return db
        .select({ id: boards.id, title: boards.title, listCount, cardCount })
        .from(boards)
        .where(eq(boards.ownerId, userId))
        .orderBy(asc(boards.createdAt));
}

export async function createBoard(userId: string, title: string) {
    // neon-http has no interactive transactions, but a batch runs in one
    // transaction: the board is never left without its lists. The id is
    // generated here because lists can't read the board insert's result.
    // Explicit createdAt keeps list order stable (now() is equal inside a transaction).
    const boardId = crypto.randomUUID();
    const now = Date.now();
    const [[board]] = await db.batch([
        db
            .insert(boards)
            .values({ id: boardId, ownerId: userId, title })
            .returning(),
        db.insert(lists).values(
            DEFAULT_LIST_TITLES.map((listTitle, i) => ({
                boardId,
                title: listTitle,
                createdAt: new Date(now + i),
            })),
        ),
    ]);

    return board;
}

export function renameBoard(userId: string, boardId: string, title: string) {
    return db
        .update(boards)
        .set({ title })
        .where(and(eq(boards.id, boardId), eq(boards.ownerId, userId)))
        .returning();
}

export function deleteBoard(userId: string, boardId: string) {
    return db
        .delete(boards)
        .where(and(eq(boards.id, boardId), eq(boards.ownerId, userId)))
        .returning();
}

export async function getBoard(userId: string, boardId: string) {
    const board = await db.query.boards.findFirst({
        where: (b) => and(eq(b.id, boardId), eq(b.ownerId, userId)),
        with: {
            lists: {
                orderBy: (l, { asc }) => asc(l.createdAt),
                with: {
                    cards: {
                        orderBy: (c, { desc }) => desc(c.createdAt),
                    },
                },
            },
        },
    });
    if (!board) return null;

    const { lists: boardLists, ...boardFields } = board;
    return { board: boardFields, lists: boardLists };
}

export async function addList(userId: string, boardId: string, title: string) {
    const board = await db.query.boards.findFirst({
        where: (b) => and(eq(b.id, boardId), eq(b.ownerId, userId)),
    });
    if (!board) return null;

    const [row] = await db.insert(lists).values({ boardId, title }).returning();
    return row;
}

export function renameList(userId: string, listId: string, title: string) {
    return db
        .update(lists)
        .set({ title })
        .where(
            and(
                eq(lists.id, listId),
                inArray(lists.boardId, ownedBoardIds(userId)),
            ),
        )
        .returning();
}

export function deleteList(userId: string, listId: string) {
    return db
        .delete(lists)
        .where(
            and(
                eq(lists.id, listId),
                inArray(lists.boardId, ownedBoardIds(userId)),
            ),
        )
        .returning();
}

export async function addCard(userId: string, listId: string, title: string) {
    const list = await db.query.lists.findFirst({
        where: (l) => eq(l.id, listId),
        with: { board: true },
    });
    if (!list || list.board.ownerId !== userId) return null;

    const [row] = await db.insert(cards).values({ listId, title }).returning();
    return row;
}

export function updateCard(
    userId: string,
    cardId: string,
    data: { title?: string; description?: string | null },
) {
    return db
        .update(cards)
        .set(data)
        .where(
            and(
                eq(cards.id, cardId),
                inArray(cards.listId, ownedListIds(userId)),
            ),
        )
        .returning();
}

export async function moveCard(
    userId: string,
    cardId: string,
    toListId: string,
) {
    const card = await db.query.cards.findFirst({
        where: (c) => eq(c.id, cardId),
        with: { list: { with: { board: true } } },
    });
    if (!card || card.list.board.ownerId !== userId) return null;

    const targetList = await db.query.lists.findFirst({
        where: (l) => eq(l.id, toListId),
        with: { board: true },
    });
    if (!targetList || targetList.board.ownerId !== userId) return null;
    if (targetList.boardId !== card.list.boardId) return null;

    const [row] = await db
        .update(cards)
        .set({ listId: toListId })
        .where(eq(cards.id, cardId))
        .returning();
    return row;
}

export function deleteCard(userId: string, cardId: string) {
    return db
        .delete(cards)
        .where(
            and(
                eq(cards.id, cardId),
                inArray(cards.listId, ownedListIds(userId)),
            ),
        )
        .returning();
}
