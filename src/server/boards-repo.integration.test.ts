import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import { boards, cards, lists } from '#/db/schema';
import {
    addCard,
    addList,
    createBoard,
    deleteBoard,
    deleteCard,
    deleteList,
    getBoard,
    listBoards,
    moveCard,
    renameBoard,
    renameList,
    updateCard,
} from '#/server/boards-repo';
import { seedUser } from '#/test/db';
import { eq } from 'drizzle-orm';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('listBoards', () => {
    it('returns own boards ascending by createdAt with list and card counts', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const first = await createBoard(a.id, 'First');
        const second = await createBoard(a.id, 'Second');
        await createBoard(b.id, 'Foreign');
        const [todo] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, first.id))
            .orderBy(lists.createdAt);
        await addCard(a.id, todo.id, 'one');
        await addCard(a.id, todo.id, 'two');

        const result = await listBoards(a.id);

        expect(result).toEqual([
            { id: first.id, title: 'First', listCount: 2, cardCount: 2 },
            { id: second.id, title: 'Second', listCount: 2, cardCount: 0 },
        ]);
    });

    it('returns zero counts for a board without lists and cards', async () => {
        const a = await seedUser();
        const [board] = await db
            .insert(boards)
            .values({ ownerId: a.id, title: 'Empty' })
            .returning();

        expect(await listBoards(a.id)).toEqual([
            { id: board.id, title: 'Empty', listCount: 0, cardCount: 0 },
        ]);
    });

    it('returns an empty array for a user without boards', async () => {
        const a = await seedUser();

        expect(await listBoards(a.id)).toEqual([]);
    });
});

describe('createBoard', () => {
    it('creates a board with the given title and two lists in order', async () => {
        const a = await seedUser();

        const board = await createBoard(a.id, 'Roadmap');

        expect(board.title).toBe('Roadmap');
        expect(board.ownerId).toBe(a.id);
        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .orderBy(lists.createdAt);
        expect(boardLists.map((l) => l.title)).toEqual(['To do', 'Done']);
    });

    it('creates a new board on each call', async () => {
        const a = await seedUser();

        const first = await createBoard(a.id, 'Same');
        const second = await createBoard(a.id, 'Same');

        expect(second.id).not.toBe(first.id);
    });
});

describe('renameBoard', () => {
    it('renames the own board', async () => {
        const a = await seedUser();
        const board = await createBoard(a.id, 'Old');

        const rows = await renameBoard(a.id, board.id, 'New');

        expect(rows).toHaveLength(1);
        const [row] = await db
            .select()
            .from(boards)
            .where(eq(boards.id, board.id));
        expect(row.title).toBe('New');
    });

    it('does not rename another user board', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await createBoard(a.id, 'Old');

        const rows = await renameBoard(b.id, board.id, 'Hacked');

        expect(rows).toEqual([]);
        const [row] = await db
            .select()
            .from(boards)
            .where(eq(boards.id, board.id));
        expect(row.title).toBe('Old');
    });

    it('returns nothing for a non-existent board', async () => {
        const a = await seedUser();

        expect(await renameBoard(a.id, MISSING_ID, 'x')).toEqual([]);
    });
});

describe('deleteBoard', () => {
    it('deletes the own board with its lists and cards', async () => {
        const a = await seedUser();
        const board = await createBoard(a.id, 'Doomed');
        const [todo] = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id))
            .orderBy(lists.createdAt);
        const card = await addCard(a.id, todo.id, 'card');

        const rows = await deleteBoard(a.id, board.id);

        expect(rows).toHaveLength(1);
        expect(
            await db.select().from(boards).where(eq(boards.id, board.id)),
        ).toEqual([]);
        expect(
            await db.select().from(lists).where(eq(lists.boardId, board.id)),
        ).toEqual([]);
        expect(
            await db.select().from(cards).where(eq(cards.id, card!.id)),
        ).toEqual([]);
    });

    it('does not delete another user board', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await createBoard(a.id, 'Mine');

        const rows = await deleteBoard(b.id, board.id);

        expect(rows).toEqual([]);
        const remaining = await db
            .select()
            .from(boards)
            .where(eq(boards.id, board.id));
        expect(remaining).toHaveLength(1);
        const remainingLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, board.id));
        expect(remainingLists).toHaveLength(2);
    });

    it('returns nothing for a non-existent board', async () => {
        const a = await seedUser();

        expect(await deleteBoard(a.id, MISSING_ID)).toEqual([]);
    });
});

describe('getBoard', () => {
    it('returns lists ascending by createdAt and cards descending by createdAt', async () => {
        const a = await seedUser();
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');

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
        const board = await createBoard(a.id, 'Board');

        const row = await addList(a.id, board.id, 'In progress');

        expect(row?.title).toBe('In progress');
        expect(row?.boardId).toBe(board.id);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await createBoard(a.id, 'Board');

        const row = await addList(b.id, board.id, 'hacked');
        expect(row).toBeNull();
    });
});

describe('renameList', () => {
    it('renames a list on the owner board', async () => {
        const a = await seedUser();
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
        const board = await createBoard(a.id, 'Board');
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
