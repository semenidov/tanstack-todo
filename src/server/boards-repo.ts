import { db } from '#/db';
import { DEMO_BOARD } from '#/lib/demo-board';
import { QuotaExceededError, QuotaKind, USER_QUOTAS } from '#/lib/quotas';
import type { Quotas } from '#/lib/quotas';
import { boards, cards, lists } from '#/db/schema';
import { ownedBoardIds, ownedListIds } from '#/server/access';
import {
    and,
    asc,
    count,
    countDistinct,
    eq,
    inArray,
    isNull,
    max,
    min,
} from 'drizzle-orm';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

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

// Quotas: count the live rows, then insert. Without a transaction (neon-http) two
// parallel creates at the boundary can overshoot by one - acceptable.

async function assertBelowQuota(
    kind: QuotaKind,
    quotas: Quotas,
    countLive: () => Promise<Array<{ n: number }>>,
) {
    const [{ n }] = await countLive();
    if (n >= quotas[kind]) throw new QuotaExceededError(kind, quotas[kind]);
}

function countLiveLists(boardId: string) {
    return db
        .select({ n: count() })
        .from(lists)
        .where(and(eq(lists.boardId, boardId), isNull(lists.deletedAt)));
}

function countLiveCards(listId: string) {
    return db
        .select({ n: count() })
        .from(cards)
        .where(and(eq(cards.listId, listId), isNull(cards.deletedAt)));
}

export async function createBoard(
    userId: string,
    title: string,
    quotas: Quotas = USER_QUOTAS,
) {
    // Boards are deleted for real, so every row counts.
    await assertBelowQuota(QuotaKind.Boards, quotas, () =>
        db
            .select({ n: count() })
            .from(boards)
            .where(eq(boards.ownerId, userId)),
    );
    const [board] = await db
        .insert(boards)
        .values({ ownerId: userId, title })
        .returning();
    return board;
}

/** The guest's demo board (#84): board, lists in order, cards in the given order. */
export async function seedDemoBoard(userId: string) {
    const [board] = await db
        .insert(boards)
        .values({ ownerId: userId, title: DEMO_BOARD.title })
        .returning();
    const listKeys = generateNKeysBetween(null, null, DEMO_BOARD.lists.length);
    const listRows = await db
        .insert(lists)
        .values(
            DEMO_BOARD.lists.map((list, i) => ({
                boardId: board.id,
                title: list.title,
                position: listKeys[i],
            })),
        )
        .returning();
    // RETURNING order is not guaranteed by Postgres: match the rows by key.
    const listIdByKey = new Map(listRows.map((l) => [l.position, l.id]));
    const cardRows = DEMO_BOARD.lists.flatMap((list, i) => {
        const keys = generateNKeysBetween(null, null, list.cards.length);
        const listId = listIdByKey.get(listKeys[i]);
        if (!listId) throw new Error('Demo list was not inserted');
        return list.cards.map((card, j) => ({
            listId,
            title: card.title,
            description: card.description,
            position: keys[j],
        }));
    });
    await db.insert(cards).values(cardRows);
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
                orderBy: (l) => [asc(l.position), asc(l.id)],
                with: {
                    cards: {
                        columns: { deletedAt: false },
                        where: (c) => isNull(c.deletedAt),
                        orderBy: (c) => [asc(c.position), asc(c.id)],
                    },
                },
            },
        },
    });
    if (!board) return null;

    const { lists: boardLists, ...boardFields } = board;
    return { board: boardFields, lists: boardLists };
}

// List order: like cards, `position` is a fractional-indexing key compared
// byte-wise (COLLATE "C"), ties broken by id; keys are made only here.

/**
 * Key after the last list of the board, deleted ones included: a new list goes
 * last, and Undo of a deleted list never finds its key taken by a newer one.
 */
async function lastListPositionKey(boardId: string) {
    // An aggregate always returns one row; max is null for a board without lists.
    const [last] = await db
        .select({ position: max(lists.position) })
        .from(lists)
        .where(eq(lists.boardId, boardId));
    return generateKeyBetween(last.position, null);
}

export async function addList(
    userId: string,
    boardId: string,
    title: string,
    quotas: Quotas = USER_QUOTAS,
) {
    const board = await db.query.boards.findFirst({
        where: (b) => and(eq(b.id, boardId), eq(b.ownerId, userId)),
    });
    if (!board) return null;
    await assertBelowQuota(QuotaKind.Lists, quotas, () =>
        countLiveLists(boardId),
    );

    const position = await lastListPositionKey(boardId);
    const [row] = await db
        .insert(lists)
        .values({ boardId, title, position })
        .returning();
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

// Restore makes a row live again, so it passes the same quota check as create.
// The deleted row itself is not among the live ones it counts.
export async function restoreList(
    userId: string,
    listId: string,
    quotas: Quotas = USER_QUOTAS,
) {
    const list = await db.query.lists.findFirst({
        where: (l) => eq(l.id, listId),
        with: { board: true },
    });
    if (list?.deletedAt && list.board.ownerId === userId) {
        await assertBelowQuota(QuotaKind.Lists, quotas, () =>
            countLiveLists(list.boardId),
        );
    }
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

/**
 * Live neighbor lists on the target board, by id. Undefined if any given id is
 * not a live list of that board (another board, deleted, missing).
 */
async function readListNeighbors(
    boardId: string,
    neighborIds: Array<string>,
): Promise<Map<string, string> | undefined> {
    if (neighborIds.length === 0) return new Map();
    const rows = await db
        .select({ id: lists.id, position: lists.position })
        .from(lists)
        .where(
            and(
                inArray(lists.id, neighborIds),
                eq(lists.boardId, boardId),
                isNull(lists.deletedAt),
            ),
        );
    if (rows.length !== new Set(neighborIds).size) return undefined;
    return new Map(rows.map((r) => [r.id, r.position]));
}

/**
 * Gives every list of the board (deleted included, so Undo restores to the same
 * place) a fresh key in the current order. Like renumberList: sequential updates
 * without a transaction, a rare path.
 */
async function renumberLists(boardId: string) {
    const rows = await db
        .select({ id: lists.id })
        .from(lists)
        .where(eq(lists.boardId, boardId))
        .orderBy(asc(lists.position), asc(lists.id));
    const keys = generateNKeysBetween(null, null, rows.length);
    for (const [i, row] of rows.entries()) {
        await db
            .update(lists)
            .set({ position: keys[i] })
            .where(eq(lists.id, row.id));
    }
}

/**
 * Moves a list between two neighbors on the target board: its own board or
 * another one of the same owner. Cards point at the list only, so they move with
 * it untouched. Null on any refusal.
 */
export async function moveList(
    userId: string,
    listId: string,
    toBoardId: string,
    prevListId: string | null,
    nextListId: string | null,
    quotas: Quotas = USER_QUOTAS,
) {
    if (prevListId === listId || nextListId === listId) return null;
    if (prevListId !== null && prevListId === nextListId) return null;

    const list = await db.query.lists.findFirst({
        where: (l) => and(eq(l.id, listId), isNull(l.deletedAt)),
        with: { board: true },
    });
    if (!list || list.board.ownerId !== userId) return null;

    const targetBoard = await db.query.boards.findFirst({
        where: (b) => and(eq(b.id, toBoardId), eq(b.ownerId, userId)),
    });
    if (!targetBoard) return null;
    // A move onto another board adds a live list to it; within one board the count stays.
    if (toBoardId !== list.boardId) {
        await assertBelowQuota(QuotaKind.Lists, quotas, () =>
            countLiveLists(toBoardId),
        );
    }

    const neighborIds = [prevListId, nextListId].filter((id) => id !== null);
    const positionOf = (map: Map<string, string>, id: string | null) =>
        id === null ? null : (map.get(id) ?? null);

    let neighbors = await readListNeighbors(toBoardId, neighborIds);
    if (!neighbors) return null;
    let position = keyBetween(
        positionOf(neighbors, prevListId),
        positionOf(neighbors, nextListId),
    );
    if (position === undefined) {
        // Equal keys (two tabs, Undo onto a reused key): renumber and try once more.
        await renumberLists(toBoardId);
        neighbors = await readListNeighbors(toBoardId, neighborIds);
        if (!neighbors) return null;
        position = keyBetween(
            positionOf(neighbors, prevListId),
            positionOf(neighbors, nextListId),
        );
        // Still out of order: the client sent neighbors in a stale order.
        if (position === undefined) return null;
    }

    const rows = await db
        .update(lists)
        .set({ boardId: toBoardId, position })
        .where(and(eq(lists.id, listId), isNull(lists.deletedAt)))
        .returning();
    return rows.at(0) ?? null;
}

// Card order: `position` is a fractional-indexing key compared byte-wise (the column
// is COLLATE "C"), ties broken by id. Keys are made only here; the client sends the
// neighbors the card should land between.

/** Key before the first live card of the list: new cards go on top. */
async function firstPositionKey(listId: string) {
    // An aggregate always returns one row; min is null for an empty list.
    const [first] = await db
        .select({ position: min(cards.position) })
        .from(cards)
        .where(and(eq(cards.listId, listId), isNull(cards.deletedAt)));
    return generateKeyBetween(null, first.position);
}

export async function addCard(
    userId: string,
    listId: string,
    title: string,
    quotas: Quotas = USER_QUOTAS,
) {
    const list = await db.query.lists.findFirst({
        where: (l) => and(eq(l.id, listId), isNull(l.deletedAt)),
        with: { board: true },
    });
    if (!list || list.board.ownerId !== userId) return null;
    await assertBelowQuota(QuotaKind.Cards, quotas, () =>
        countLiveCards(listId),
    );

    const position = await firstPositionKey(listId);
    const [row] = await db
        .insert(cards)
        .values({ listId, title, position })
        .returning();
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

/**
 * Live neighbor cards in the target list, by id. Undefined if any given id is not
 * a live card of that list (another list or board, deleted, missing).
 */
async function readNeighbors(
    listId: string,
    neighborIds: Array<string>,
): Promise<Map<string, string> | undefined> {
    if (neighborIds.length === 0) return new Map();
    const rows = await db
        .select({ id: cards.id, position: cards.position })
        .from(cards)
        .where(
            and(
                inArray(cards.id, neighborIds),
                eq(cards.listId, listId),
                isNull(cards.deletedAt),
            ),
        );
    if (rows.length !== new Set(neighborIds).size) return undefined;
    return new Map(rows.map((r) => [r.id, r.position]));
}

/**
 * Gives every card of the list (deleted included, so Undo restores to the same
 * place) a fresh key in the current order. Sequential updates without a
 * transaction: a rare path, and the next renumbering fixes a partial failure.
 */
async function renumberList(listId: string) {
    const rows = await db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.listId, listId))
        .orderBy(asc(cards.position), asc(cards.id));
    const keys = generateNKeysBetween(null, null, rows.length);
    for (const [i, row] of rows.entries()) {
        await db
            .update(cards)
            .set({ position: keys[i] })
            .where(eq(cards.id, row.id));
    }
}

/** Key strictly between the neighbors, or undefined if their keys are not ordered. */
function keyBetween(
    prev: string | null,
    next: string | null,
): string | undefined {
    if (prev !== null && next !== null && prev >= next) return undefined;
    return generateKeyBetween(prev, next);
}

export async function moveCard(
    userId: string,
    cardId: string,
    toListId: string,
    prevCardId: string | null,
    nextCardId: string | null,
    quotas: Quotas = USER_QUOTAS,
) {
    if (prevCardId === cardId || nextCardId === cardId) return null;
    if (prevCardId !== null && prevCardId === nextCardId) return null;

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
    // A move into another list adds a live card to it; within one list the count stays.
    if (toListId !== card.listId) {
        await assertBelowQuota(QuotaKind.Cards, quotas, () =>
            countLiveCards(toListId),
        );
    }

    const neighborIds = [prevCardId, nextCardId].filter((id) => id !== null);
    const positionOf = (map: Map<string, string>, id: string | null) =>
        id === null ? null : (map.get(id) ?? null);

    let neighbors = await readNeighbors(toListId, neighborIds);
    if (!neighbors) return null;
    let position = keyBetween(
        positionOf(neighbors, prevCardId),
        positionOf(neighbors, nextCardId),
    );
    if (position === undefined) {
        // Equal keys (two tabs inserted at one place, Undo restored a card onto a
        // reused key): renumber and try once more.
        await renumberList(toListId);
        neighbors = await readNeighbors(toListId, neighborIds);
        if (!neighbors) return null;
        position = keyBetween(
            positionOf(neighbors, prevCardId),
            positionOf(neighbors, nextCardId),
        );
        // Still out of order: the client sent neighbors in a stale order.
        if (position === undefined) return null;
    }

    const rows = await db
        .update(cards)
        .set({ listId: toListId, position })
        .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
        .returning();
    return rows.at(0) ?? null;
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
export async function restoreCard(
    userId: string,
    cardId: string,
    quotas: Quotas = USER_QUOTAS,
) {
    const card = await db.query.cards.findFirst({
        where: (c) => eq(c.id, cardId),
        with: { list: { with: { board: true } } },
    });
    if (
        card?.deletedAt &&
        !card.list.deletedAt &&
        card.list.board.ownerId === userId
    ) {
        await assertBelowQuota(QuotaKind.Cards, quotas, () =>
            countLiveCards(card.listId),
        );
    }
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
