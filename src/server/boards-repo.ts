import { db } from '#/db';
import { boards, cards, lists } from '#/db/schema';
import {
    and,
    asc,
    count,
    countDistinct,
    eq,
    inArray,
    isNull,
} from 'drizzle-orm';

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
        .where(and(eq(boards.ownerId, userId), isNull(lists.deletedAt)));
}

export function listBoards(userId: string) {
    // Left joins keep boards without lists/cards; counting non-null ids gives 0 for them.
    // A card belongs to one list, so count(cards.id) has no duplicates; lists repeat
    // once per card, hence countDistinct. Soft-deleted rows are filtered in the join
    // conditions, not in where: otherwise boards without live lists would disappear.
    return db
        .select({
            id: boards.id,
            title: boards.title,
            listCount: countDistinct(lists.id),
            cardCount: count(cards.id),
        })
        .from(boards)
        .leftJoin(
            lists,
            and(eq(lists.boardId, boards.id), isNull(lists.deletedAt)),
        )
        .leftJoin(
            cards,
            and(eq(cards.listId, lists.id), isNull(cards.deletedAt)),
        )
        .where(eq(boards.ownerId, userId))
        .groupBy(boards.id)
        .orderBy(asc(boards.createdAt));
}

export async function createBoard(userId: string, title: string) {
    const [board] = await db
        .insert(boards)
        .values({ ownerId: userId, title })
        .returning();
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
            // deletedAt is always null here, so it is left out of the client types.
            lists: {
                columns: { deletedAt: false },
                where: (l) => isNull(l.deletedAt),
                orderBy: (l) => asc(l.createdAt),
                with: {
                    cards: {
                        columns: { deletedAt: false },
                        where: (c) => isNull(c.deletedAt),
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
                isNull(lists.deletedAt),
            ),
        )
        .returning();
}

// Soft delete: the list's cards stay untouched, they are hidden with the list and
// come back on restore.
export function deleteList(userId: string, listId: string) {
    return db
        .update(lists)
        .set({ deletedAt: new Date() })
        .where(
            and(
                eq(lists.id, listId),
                inArray(lists.boardId, ownedBoardIds(userId)),
                isNull(lists.deletedAt),
            ),
        )
        .returning();
}

export function restoreList(userId: string, listId: string) {
    return db
        .update(lists)
        .set({ deletedAt: null })
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
        where: (l) => and(eq(l.id, listId), isNull(l.deletedAt)),
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
                isNull(cards.deletedAt),
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
        where: (c) => and(eq(c.id, cardId), isNull(c.deletedAt)),
        with: { list: { with: { board: true } } },
    });
    if (!card || card.list.deletedAt || card.list.board.ownerId !== userId)
        return null;

    const targetList = await db.query.lists.findFirst({
        where: (l) => and(eq(l.id, toListId), isNull(l.deletedAt)),
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
        .update(cards)
        .set({ deletedAt: new Date() })
        .where(
            and(
                eq(cards.id, cardId),
                inArray(cards.listId, ownedListIds(userId)),
                isNull(cards.deletedAt),
            ),
        )
        .returning();
}

// A card in a deleted list stays hidden: ownedListIds skips deleted lists.
export function restoreCard(userId: string, cardId: string) {
    return db
        .update(cards)
        .set({ deletedAt: null })
        .where(
            and(
                eq(cards.id, cardId),
                inArray(cards.listId, ownedListIds(userId)),
            ),
        )
        .returning();
}
