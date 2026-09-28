import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import { boards, cards, lists } from '#/db/schema';
import {
    addCard,
    addList,
    deleteCard,
    deleteList,
    getBoard,
    getDefaultBoard,
    moveCard,
    renameList,
    updateCard,
} from '#/server/boards-repo';
import { seedUser } from '#/test/db';
import { eq } from 'drizzle-orm';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('getDefaultBoard', () => {
    it('creates a board with two default lists on first call', async () => {
        const a = await seedUser();

        const board = await getDefaultBoard(a.id);

        expect(board.title).toBe('My tasks');
        expect(board.ownerId).toBe(a.id);

        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id));
        expect(boardLists.map((l) => l.title).sort()).toEqual([
            'Done',
            'To do',
        ]);
    });

    it('returns the same board on a repeated call', async () => {
        const a = await seedUser();

        const first = await getDefaultBoard(a.id);
        const second = await getDefaultBoard(a.id);

        expect(second.id).toBe(first.id);
    });
});

describe('getBoard', () => {
    it('returns lists ascending by createdAt and cards descending by createdAt', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .orderBy(lists.createdAt);
        const [todoList] = boardLists;

        const older = await addCard(a.id, todoList.id, 'older');
        const newer = await addCard(a.id, todoList.id, 'newer');

        const result = await getBoard(a.id, board.id);

        expect(result?.lists.map((l) => l.title)).toEqual(
            boardLists.map((l) => l.title),
        );
        expect(result?.lists[0].cards.map((c) => c.id)).toEqual([
            newer!.id,
            older!.id,
        ]);
    });

    it('returns null for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);

        expect(await getBoard(b.id, board.id)).toBeNull();
    });

    it('returns null for a non-existent board', async () => {
        const a = await seedUser();
        expect(await getBoard(a.id, MISSING_ID)).toBeNull();
    });
});

describe('addList', () => {
    it('adds a list for the board owner', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);

        const row = await addList(a.id, board.id, 'In progress');

        expect(row?.title).toBe('In progress');
        expect(row?.boardId).toBe(board.id);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);

        const row = await addList(b.id, board.id, 'hacked');
        expect(row).toBeNull();
    });
});

describe('renameList', () => {
    it('renames a list on the owner board', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);

        const affected = await renameList(a.id, list.id, 'renamed');
        expect(affected).toHaveLength(1);
        expect(affected[0].title).toBe('renamed');
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);

        const affected = await renameList(b.id, list.id, 'hacked');
        expect(affected).toHaveLength(0);
    });
});

describe('deleteList', () => {
    it('deletes a list and its cards', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);
        const card = await addCard(a.id, list.id, 'card');

        const affected = await deleteList(a.id, list.id);
        expect(affected).toHaveLength(1);

        const remainingCards = await db
            .select()
            .from(cards)
            .where(eq(cards.id, card!.id));
        expect(remainingCards).toHaveLength(0);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);

        const affected = await deleteList(b.id, list.id);
        expect(affected).toHaveLength(0);
    });
});

describe('addCard', () => {
    it('adds a card to a list on the owner board', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);

        const row = await addCard(a.id, list.id, 'new card');
        expect(row?.title).toBe('new card');
        expect(row?.listId).toBe(list.id);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);

        const row = await addCard(b.id, list.id, 'hacked');
        expect(row).toBeNull();
    });
});

describe('updateCard', () => {
    it('updates title and description for the owner', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);
        const card = await addCard(a.id, list.id, 'original');

        const affected = await updateCard(a.id, card!.id, {
            title: 'renamed',
            description: 'details',
        });
        expect(affected).toHaveLength(1);
        expect(affected[0].title).toBe('renamed');
        expect(affected[0].description).toBe('details');
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);
        const card = await addCard(a.id, list.id, 'original');

        const affected = await updateCard(b.id, card!.id, { title: 'hacked' });
        expect(affected).toHaveLength(0);
    });
});

describe('moveCard', () => {
    it('moves a card to another list on the same board', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .orderBy(lists.createdAt);
        const [fromList, toList] = boardLists;
        const card = await addCard(a.id, fromList.id, 'card');

        const row = await moveCard(a.id, card!.id, toList.id);
        expect(row?.listId).toBe(toList.id);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);
        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .orderBy(lists.createdAt);
        const [fromList, toList] = boardLists;
        const card = await addCard(a.id, fromList.id, 'card');

        const row = await moveCard(b.id, card!.id, toList.id);
        expect(row).toBeNull();
        expect(
            (await db.select().from(cards).where(eq(cards.id, card!.id)))[0]
                .listId,
        ).toBe(fromList.id);
    });

    it('refuses to move a card to a list on another board of the same owner', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);
        const card = await addCard(a.id, list.id, 'card');

        const [otherBoard] = await db
            .insert(boards)
            .values({ ownerId: a.id, title: 'Other board' })
            .returning();
        const [otherList] = await db
            .insert(lists)
            .values({ boardId: otherBoard.id, title: 'Other list' })
            .returning();

        const row = await moveCard(a.id, card!.id, otherList.id);
        expect(row).toBeNull();
        expect(
            (await db.select().from(cards).where(eq(cards.id, card!.id)))[0]
                .listId,
        ).toBe(list.id);
    });
});

describe('deleteCard', () => {
    it('deletes a card for the owner', async () => {
        const a = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);
        const card = await addCard(a.id, list.id, 'card');

        const affected = await deleteCard(a.id, card!.id);
        expect(affected).toHaveLength(1);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await getDefaultBoard(a.id);
        const [list] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .limit(1);
        const card = await addCard(a.id, list.id, 'card');

        const affected = await deleteCard(b.id, card!.id);
        expect(affected).toHaveLength(0);
    });
});
