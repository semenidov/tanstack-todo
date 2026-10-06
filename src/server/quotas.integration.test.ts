import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import { boards, cards, lists } from '#/db/schema';
import {
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
    restoreCard,
    restoreList,
} from '#/server/boards-repo';
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
    return db
        .insert(lists)
        .values(range(n).map((i) => ({ boardId, title: `List ${i}` })))
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
});
