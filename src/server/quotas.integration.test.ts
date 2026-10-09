import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import {
    boards,
    cardLabels,
    cards,
    checklistItems,
    checklists,
    labels,
    lists,
} from '#/db/schema';
import {
    GUEST_QUOTAS,
    MAX_BOARDS_PER_USER,
    MAX_CARDS_PER_LIST,
    MAX_LISTS_PER_BOARD,
    QuotaExceededError,
    QuotaKind,
} from '#/lib/quotas';
import {
    addCard,
    addList,
    createBoard,
    deleteBoard,
    deleteCard,
    deleteList,
    moveCard,
    moveList,
    restoreCard,
    restoreList,
} from '#/server/boards-repo';
import {
    addCardAs,
    addCardLabelAs,
    addChecklistItemAs,
    addListAs,
    createLabelAs,
    createBoardAs,
    restoreCardAs,
    restoreListAs,
} from '#/server/board-writes';
import { moveCardOrThrow } from '#/server/move-card';
import { moveListOrThrow } from '#/server/move-list';
import { seedUser } from '#/test/db';
import { and, count, eq, isNull } from 'drizzle-orm';
import { generateNKeysBetween } from 'fractional-indexing';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

async function seedBoards(userId: string, n: number) {
    return db
        .insert(boards)
        .values(range(n).map((i) => ({ ownerId: userId, title: `Board ${i}` })))
        .returning();
}

async function seedLists(boardId: string, n: number) {
    const keys = generateNKeysBetween(null, null, n);
    return db
        .insert(lists)
        .values(
            keys.map((position, i) => ({
                boardId,
                title: `List ${i}`,
                position,
            })),
        )
        .returning();
}

async function seedCards(listId: string, n: number) {
    const keys = generateNKeysBetween(null, null, n);
    return db
        .insert(cards)
        .values(
            keys.map((position, i) => ({
                listId,
                title: `Card ${i}`,
                position,
            })),
        )
        .returning();
}

async function liveCardCount(listId: string) {
    const [row] = await db
        .select({ n: count() })
        .from(cards)
        .where(and(eq(cards.listId, listId), isNull(cards.deletedAt)));
    return row.n;
}

describe('board quota', () => {
    it('refuses a board over the limit with a quota error', async () => {
        const user = await seedUser();
        await seedBoards(user.id, MAX_BOARDS_PER_USER);

        await expect(createBoard(user.id, 'One more')).rejects.toThrow(
            new QuotaExceededError(QuotaKind.Boards, MAX_BOARDS_PER_USER),
        );
        const [row] = await db
            .select({ n: count() })
            .from(boards)
            .where(eq(boards.ownerId, user.id));
        expect(row.n).toBe(MAX_BOARDS_PER_USER);
    });

    it('creates a board again after one is deleted', async () => {
        const user = await seedUser();
        const [first] = await seedBoards(user.id, MAX_BOARDS_PER_USER);
        await deleteBoard(user.id, first.id);

        const board = await createBoard(user.id, 'Fits again');
        expect(board.title).toBe('Fits again');
    });

    it('does not count boards of other users', async () => {
        const other = await seedUser();
        const user = await seedUser();
        await seedBoards(other.id, MAX_BOARDS_PER_USER);

        const board = await createBoard(user.id, 'Mine');
        expect(board.ownerId).toBe(user.id);
    });
});

describe('list quota', () => {
    it('refuses a list over the board limit with a quota error', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        await seedLists(board.id, MAX_LISTS_PER_BOARD);

        await expect(addList(user.id, board.id, 'One more')).rejects.toThrow(
            new QuotaExceededError(QuotaKind.Lists, MAX_LISTS_PER_BOARD),
        );
    });

    it('does not count deleted lists', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [first] = await seedLists(board.id, MAX_LISTS_PER_BOARD);
        await deleteList(user.id, first.id);

        const row = await addList(user.id, board.id, 'Fits again');
        expect(row?.title).toBe('Fits again');
    });
});

describe('card quota', () => {
    // addCardServer is a thin wrapper over addCard, so this is the check a direct
    // server fn call meets: the client cannot skip it.
    it('refuses a card over the list limit with a quota error', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [list] = await seedLists(board.id, 1);
        await seedCards(list.id, MAX_CARDS_PER_LIST);

        await expect(addCard(user.id, list.id, 'One more')).rejects.toThrow(
            new QuotaExceededError(QuotaKind.Cards, MAX_CARDS_PER_LIST),
        );
        expect(await liveCardCount(list.id)).toBe(MAX_CARDS_PER_LIST);
    });

    it('does not count deleted cards', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [list] = await seedLists(board.id, 1);
        const [first] = await seedCards(list.id, MAX_CARDS_PER_LIST);
        await deleteCard(user.id, first.id);

        const row = await addCard(user.id, list.id, 'Fits again');
        expect(row?.title).toBe('Fits again');
    });

    it('counts cards per list, not per board', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [full, other] = await seedLists(board.id, 2);
        await seedCards(full.id, MAX_CARDS_PER_LIST);

        const row = await addCard(user.id, other.id, 'Other list');
        expect(row?.listId).toBe(other.id);
    });
});

describe('restore and quotas', () => {
    it('refuses to restore a list when the board is full again', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [first] = await seedLists(board.id, MAX_LISTS_PER_BOARD);
        await deleteList(user.id, first.id);
        await addList(user.id, board.id, 'Took the place');

        await expect(restoreList(user.id, first.id)).rejects.toThrow(
            new QuotaExceededError(QuotaKind.Lists, MAX_LISTS_PER_BOARD),
        );
        const [row] = await db
            .select()
            .from(lists)
            .where(eq(lists.id, first.id));
        expect(row.deletedAt).not.toBeNull();
    });

    it('restores a list while the board is under the limit', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [first] = await seedLists(board.id, MAX_LISTS_PER_BOARD);
        await deleteList(user.id, first.id);

        const rows = await restoreList(user.id, first.id);
        expect(rows[0]?.deletedAt).toBeNull();
    });

    it('refuses to restore a card when the list is full again', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [list] = await seedLists(board.id, 1);
        const [first] = await seedCards(list.id, MAX_CARDS_PER_LIST);
        await deleteCard(user.id, first.id);
        await addCard(user.id, list.id, 'Took the place');

        await expect(restoreCard(user.id, first.id)).rejects.toThrow(
            new QuotaExceededError(QuotaKind.Cards, MAX_CARDS_PER_LIST),
        );
        expect(await liveCardCount(list.id)).toBe(MAX_CARDS_PER_LIST);
    });

    it('restores a card while the list is under the limit', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [list] = await seedLists(board.id, 1);
        const [first] = await seedCards(list.id, MAX_CARDS_PER_LIST);
        await deleteCard(user.id, first.id);

        const rows = await restoreCard(user.id, first.id);
        expect(rows[0]?.deletedAt).toBeNull();
    });
});

describe('move and quotas', () => {
    it('refuses to move a card into a full list', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [full, other] = await seedLists(board.id, 2);
        await seedCards(full.id, MAX_CARDS_PER_LIST);
        const [card] = await seedCards(other.id, 1);

        await expect(
            moveCard(user.id, card.id, full.id, null, null),
        ).rejects.toThrow(
            new QuotaExceededError(QuotaKind.Cards, MAX_CARDS_PER_LIST),
        );
        const [row] = await db
            .select()
            .from(cards)
            .where(eq(cards.id, card.id));
        expect(row.listId).toBe(other.id);
        expect(await liveCardCount(full.id)).toBe(MAX_CARDS_PER_LIST);
    });

    it('moves a card within a full list', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [full] = await seedLists(board.id, 1);
        const seeded = await seedCards(full.id, MAX_CARDS_PER_LIST);

        const row = await moveCard(
            user.id,
            seeded[0].id,
            full.id,
            seeded[1].id,
            seeded[2].id,
        );
        expect(row?.listId).toBe(full.id);
    });

    it('moves a card into a list one below the limit', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const [target, other] = await seedLists(board.id, 2);
        await seedCards(target.id, MAX_CARDS_PER_LIST - 1);
        const [card] = await seedCards(other.id, 1);

        const row = await moveCard(user.id, card.id, target.id, null, null);
        expect(row?.listId).toBe(target.id);
    });

    it('refuses to move a list onto a full board', async () => {
        const user = await seedUser();
        const [full, other] = await seedBoards(user.id, 2);
        await seedLists(full.id, MAX_LISTS_PER_BOARD);
        const [list] = await seedLists(other.id, 1);

        await expect(
            moveList(user.id, list.id, full.id, null, null),
        ).rejects.toThrow(
            new QuotaExceededError(QuotaKind.Lists, MAX_LISTS_PER_BOARD),
        );
        const [row] = await db
            .select()
            .from(lists)
            .where(eq(lists.id, list.id));
        expect([row.boardId, row.position]).toEqual([other.id, list.position]);
    });

    it('moves a list within a full board', async () => {
        const user = await seedUser();
        const [board] = await seedBoards(user.id, 1);
        const seeded = await seedLists(board.id, MAX_LISTS_PER_BOARD);

        const row = await moveList(
            user.id,
            seeded[0].id,
            board.id,
            seeded[1].id,
            seeded[2].id,
        );
        expect(row?.boardId).toBe(board.id);
    });

    it('moves a list onto a board one below the limit', async () => {
        const user = await seedUser();
        const [target, other] = await seedBoards(user.id, 2);
        await seedLists(target.id, MAX_LISTS_PER_BOARD - 1);
        const [list] = await seedLists(other.id, 1);

        const row = await moveList(user.id, list.id, target.id, null, null);
        expect(row?.boardId).toBe(target.id);
    });
});

// The server fns call these with the session user; each insert path is checked
// here, so a path that forgets to pass the quotas gives a guest the user limits.
describe('guest quotas on every insert path', () => {
    const guestLimit = (kind: QuotaKind) =>
        new QuotaExceededError(kind, GUEST_QUOTAS[kind]);

    async function seedGuest() {
        const row = await seedUser({ isAnonymous: true });
        return { id: row.id, isAnonymous: true };
    }

    it('createBoard: refuses the 4th board', async () => {
        const guest = await seedGuest();
        await seedBoards(guest.id, GUEST_QUOTAS[QuotaKind.Boards]);

        await expect(createBoardAs(guest, 'One more')).rejects.toThrow(
            guestLimit(QuotaKind.Boards),
        );
    });

    it('addList: refuses the 11th list', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        await seedLists(board.id, GUEST_QUOTAS[QuotaKind.Lists]);

        await expect(addListAs(guest, board.id, 'One more')).rejects.toThrow(
            guestLimit(QuotaKind.Lists),
        );
    });

    it('restoreList: refuses when the board is full again', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [first] = await seedLists(
            board.id,
            GUEST_QUOTAS[QuotaKind.Lists],
        );
        await deleteList(guest.id, first.id);
        await seedLists(board.id, 1);

        await expect(restoreListAs(guest, first.id)).rejects.toThrow(
            guestLimit(QuotaKind.Lists),
        );
    });

    it('addCard: refuses the 51st card', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [list] = await seedLists(board.id, 1);
        await seedCards(list.id, GUEST_QUOTAS[QuotaKind.Cards]);

        await expect(addCardAs(guest, list.id, 'One more')).rejects.toThrow(
            guestLimit(QuotaKind.Cards),
        );
    });

    it('moveCard: refuses a move into a list with 50 cards', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [full, other] = await seedLists(board.id, 2);
        await seedCards(full.id, GUEST_QUOTAS[QuotaKind.Cards]);
        const [card] = await seedCards(other.id, 1);

        await expect(
            moveCardOrThrow(guest, {
                cardId: card.id,
                toListId: full.id,
                prevCardId: null,
                nextCardId: null,
            }),
        ).rejects.toThrow(guestLimit(QuotaKind.Cards));
    });

    it('moveList: refuses a move onto a board with 10 lists', async () => {
        const guest = await seedGuest();
        const [full, other] = await seedBoards(guest.id, 2);
        await seedLists(full.id, GUEST_QUOTAS[QuotaKind.Lists]);
        const [list] = await seedLists(other.id, 1);

        await expect(
            moveListOrThrow(guest, {
                listId: list.id,
                toBoardId: full.id,
                prevListId: null,
                nextListId: null,
            }),
        ).rejects.toThrow(guestLimit(QuotaKind.Lists));
    });

    it('createLabel: refuses the 11th label on a board', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        await db.insert(labels).values(
            range(GUEST_QUOTAS[QuotaKind.Labels]).map(() => ({
                boardId: board.id,
                title: null,
                color: 'green',
            })),
        );

        await expect(
            createLabelAs(guest, board.id, { title: 'Typed', color: 'red' }),
        ).rejects.toThrow(guestLimit(QuotaKind.Labels));
    });

    it('addCardLabel: refuses the 11th label on a card', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [list] = await seedLists(board.id, 1);
        const [card] = await seedCards(list.id, 1);
        const boardLabels = await db
            .insert(labels)
            .values(
                range(GUEST_QUOTAS[QuotaKind.CardLabels] + 1).map(() => ({
                    boardId: board.id,
                    title: null,
                    color: 'green',
                })),
            )
            .returning();
        const [extra, ...onCard] = boardLabels;
        await db
            .insert(cardLabels)
            .values(onCard.map((l) => ({ cardId: card.id, labelId: l.id })));

        await expect(addCardLabelAs(guest, card.id, extra.id)).rejects.toThrow(
            guestLimit(QuotaKind.CardLabels),
        );
    });

    it('addChecklistItem: refuses the 21st item; the checklist keeps 20', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [list] = await seedLists(board.id, 1);
        const [card] = await seedCards(list.id, 1);
        const [checklist] = await db
            .insert(checklists)
            .values({ cardId: card.id, title: 'Steps' })
            .returning();
        const limit = GUEST_QUOTAS[QuotaKind.ChecklistItems];
        const keys = generateNKeysBetween(null, null, limit);
        await db.insert(checklistItems).values(
            keys.map((position) => ({
                checklistId: checklist.id,
                title: 'Item',
                position,
            })),
        );

        await expect(
            addChecklistItemAs(guest, checklist.id, 'Typed'),
        ).rejects.toThrow(guestLimit(QuotaKind.ChecklistItems));
        const [{ n }] = await db
            .select({ n: count() })
            .from(checklistItems)
            .where(eq(checklistItems.checklistId, checklist.id));
        expect(n).toBe(limit);
    });

    it('restoreCard: refuses when the list is full again', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [list] = await seedLists(board.id, 1);
        const [first] = await seedCards(list.id, GUEST_QUOTAS[QuotaKind.Cards]);
        await deleteCard(guest.id, first.id);
        await seedCards(list.id, 1);

        await expect(restoreCardAs(guest, first.id)).rejects.toThrow(
            guestLimit(QuotaKind.Cards),
        );
        expect(await liveCardCount(list.id)).toBe(
            GUEST_QUOTAS[QuotaKind.Cards],
        );
    });

    it('gives a regular user the regular limits on every path', async () => {
        const row = await seedUser();
        const regular = { id: row.id, isAnonymous: false };
        await seedBoards(regular.id, GUEST_QUOTAS[QuotaKind.Boards]);
        const board = await createBoardAs(regular, 'Over the guest limit');

        const [firstList] = await seedLists(
            board.id,
            GUEST_QUOTAS[QuotaKind.Lists],
        );
        await deleteList(regular.id, firstList.id);
        expect(await addListAs(regular, board.id, 'Took the place')).not.toBe(
            null,
        );
        expect(await restoreListAs(regular, firstList.id)).toHaveLength(1);

        const [list, other] = await seedLists(board.id, 2);
        const [firstCard] = await seedCards(
            list.id,
            GUEST_QUOTAS[QuotaKind.Cards],
        );
        await deleteCard(regular.id, firstCard.id);
        expect(await addCardAs(regular, list.id, 'Took the place')).not.toBe(
            null,
        );
        expect(await restoreCardAs(regular, firstCard.id)).toHaveLength(1);
        const [moved] = await seedCards(other.id, 1);
        await moveCardOrThrow(regular, {
            cardId: moved.id,
            toListId: list.id,
            prevCardId: null,
            nextCardId: null,
        });
        expect(await liveCardCount(list.id)).toBe(
            GUEST_QUOTAS[QuotaKind.Cards] + 2,
        );
    });
});
