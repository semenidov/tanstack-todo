import { db } from '#/db';
import { boards, cards, lists } from '#/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

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

export async function getDefaultBoard(userId: string) {
    const existing = await db.query.boards.findFirst({
        where: (b) => eq(b.ownerId, userId),
        orderBy: (b, { asc }) => asc(b.createdAt),
    });
    if (existing) return existing;

    // neon-http has no session/socket to hold open across statements, so it
    // doesn't support interactive transactions (unlike neon-serverless over
    // a pool). This is therefore a sequential insert, not atomic: a race
    // between two requests could create two default boards. Not handled -
    // out of scope for the single-board phase.
    const [board] = await db
        .insert(boards)
        .values({ ownerId: userId, title: 'My tasks' })
        .returning();
    for (const title of DEFAULT_LIST_TITLES) {
        await db.insert(lists).values({ boardId: board.id, title });
    }
    return board;
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
