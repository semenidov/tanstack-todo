import { db } from '#/db';
import { DEMO_BOARD } from '#/lib/demo-board';
import { QuotaExceededError, QuotaKind, USER_QUOTAS } from '#/lib/quotas';
import type { Quotas } from '#/lib/quotas';
import { addDays, localDateKey } from '#/lib/due-date';
import type { Due } from '#/lib/due-date';
import {
    boards,
    cardLabels,
    cards,
    checklistItems,
    checklists,
    labels,
    lists,
} from '#/db/schema';
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
    sql,
} from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

export function listBoards(userId: string) {
    // Soft-deleted rows are filtered in the joins, not in where: otherwise boards
    // without live lists disappear. Lists repeat once per card: countDistinct.
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

export async function seedDemoBoard(
    userId: string,
    timeZone: string,
    now = new Date(),
) {
    const today = localDateKey(now, timeZone);
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
            completedAt: card.completed ? now : null,
            dueDate:
                card.dueInDays === undefined
                    ? null
                    : addDays(today, card.dueInDays),
            position: keys[j],
            labels: card.labels ?? [],
            checklist: card.checklist,
        }));
    });
    const insertedCards = await db
        .insert(cards)
        .values(cardRows.map(({ labels: _, checklist: __, ...card }) => card))
        .returning();

    const labelRows = await db
        .insert(labels)
        .values(
            DEMO_BOARD.labels.map((label, i) => ({
                boardId: board.id,
                title: label.title,
                color: label.color,
                createdAt: new Date(now.getTime() + i),
            })),
        )
        .returning();
    const labelIdByTitle = new Map(labelRows.map((l) => [l.title, l.id]));
    const cardIdBySpot = new Map(
        insertedCards.map((c) => [`${c.listId}:${c.position}`, c.id]),
    );
    const links = cardRows.flatMap((card) =>
        card.labels.map((title) => {
            const cardId = cardIdBySpot.get(`${card.listId}:${card.position}`);
            const labelId = labelIdByTitle.get(title);
            if (!cardId || !labelId) throw new Error('Demo label not seeded');
            return { cardId, labelId };
        }),
    );
    if (links.length > 0) await db.insert(cardLabels).values(links);

    const withChecklist = cardRows.flatMap(({ checklist, ...card }) => {
        if (!checklist) return [];
        const cardId = cardIdBySpot.get(`${card.listId}:${card.position}`);
        if (!cardId) throw new Error('Demo checklist not seeded');
        return [{ cardId, checklist }];
    });
    if (withChecklist.length === 0) return board;
    const checklistRows = await db
        .insert(checklists)
        .values(
            withChecklist.map(({ cardId, checklist }) => ({
                cardId,
                title: checklist.title,
            })),
        )
        .returning();
    const checklistIdByCard = new Map(
        checklistRows.map((c) => [c.cardId, c.id]),
    );
    const items = withChecklist.flatMap(({ cardId, checklist }) => {
        const checklistId = checklistIdByCard.get(cardId);
        if (!checklistId) throw new Error('Demo checklist not seeded');
        const keys = generateNKeysBetween(null, null, checklist.items.length);
        return checklist.items.map((item, i) => ({
            checklistId,
            title: item.title,
            done: item.done ?? false,
            position: keys[i],
        }));
    });
    if (items.length > 0) await db.insert(checklistItems).values(items);
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

// Relational query extras take SQL, and correlated subqueries have no builder form.
function checklistItemCount(cardId: AnyColumn, done?: true) {
    const items = db
        .select({ n: count() })
        .from(checklistItems)
        .innerJoin(checklists, eq(checklistItems.checklistId, checklists.id))
        .where(
            and(
                eq(checklists.cardId, cardId),
                done ? eq(checklistItems.done, true) : undefined,
            ),
        );
    return sql`(${items})`.mapWith(Number);
}

export async function getBoard(userId: string, boardId: string) {
    const board = await db.query.boards.findFirst({
        where: (b) => and(eq(b.id, boardId), eq(b.ownerId, userId)),
        with: {
            lists: {
                columns: { deletedAt: false },
                where: (l) => isNull(l.deletedAt),
                orderBy: (l) => [asc(l.position), asc(l.id)],
                with: {
                    cards: {
                        columns: { deletedAt: false },
                        where: (c) => isNull(c.deletedAt),
                        orderBy: (c) => [asc(c.position), asc(c.id)],
                        with: { cardLabels: { columns: { labelId: true } } },
                        extras: (card) => ({
                            checklistDone: checklistItemCount(card.id, true).as(
                                'checklist_done',
                            ),
                            checklistTotal: checklistItemCount(card.id).as(
                                'checklist_total',
                            ),
                        }),
                    },
                },
            },
        },
    });
    if (!board) return null;

    const { lists: boardLists, ...boardFields } = board;
    return {
        board: boardFields,
        lists: boardLists.map((list) => ({
            ...list,
            cards: list.cards.map(({ cardLabels: links, ...card }) => ({
                ...card,
                labelIds: links.map((l) => l.labelId),
            })),
        })),
    };
}

/** After the last list, deleted ones included: Undo never finds its key taken. */
async function lastListPositionKey(boardId: string) {
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
        await renumberLists(toBoardId);
        neighbors = await readListNeighbors(toBoardId, neighborIds);
        if (!neighbors) return null;
        position = keyBetween(
            positionOf(neighbors, prevListId),
            positionOf(neighbors, nextListId),
        );
        if (position === undefined) return null;
    }

    const rows = await db
        .update(lists)
        .set({ boardId: toBoardId, position })
        .where(and(eq(lists.id, listId), isNull(lists.deletedAt)))
        .returning();
    const row = rows.at(0) ?? null;
    if (row && toBoardId !== list.boardId) {
        // After the move, so a refused move keeps the labels. Deleted cards too, so
        // their Undo doesn't bring back labels of the old board.
        await db
            .delete(cardLabels)
            .where(
                inArray(
                    cardLabels.cardId,
                    db
                        .select({ id: cards.id })
                        .from(cards)
                        .where(eq(cards.listId, listId)),
                ),
            );
    }
    return row;
}

async function firstPositionKey(listId: string) {
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
    data: {
        title?: string;
        description?: string | null;
        completed?: boolean;
        due?: Due;
    },
) {
    const { completed, due, ...fields } = data;
    return db
        .update(cards)
        .set({
            ...fields,
            ...(completed !== undefined && {
                completedAt: completed ? new Date() : null,
            }),
            ...(due && { dueDate: due.dueDate, dueAt: due.dueAt }),
        })
        .where(
            and(
                eq(cards.id, cardId),
                inArray(cards.listId, ownedListIds(userId)),
                isNull(cards.deletedAt),
            ),
        )
        .returning();
}

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
        await renumberList(toListId);
        neighbors = await readNeighbors(toListId, neighborIds);
        if (!neighbors) return null;
        position = keyBetween(
            positionOf(neighbors, prevCardId),
            positionOf(neighbors, nextCardId),
        );
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
