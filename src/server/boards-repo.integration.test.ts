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
    restoreCard,
    restoreList,
    updateCard,
} from '#/server/boards-repo';
import { seedUser } from '#/test/db';
import { eq } from 'drizzle-orm';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

/** A board with «To do» and «Done» lists; `createBoard` itself creates an empty board. */
async function seedBoard(userId: string, title: string) {
    const board = await createBoard(userId, title);
    const now = Date.now();
    await db.insert(lists).values([
        { boardId: board.id, title: 'To do', createdAt: new Date(now) },
        { boardId: board.id, title: 'Done', createdAt: new Date(now + 1) },
    ]);
    return board;
}

/** Lists of a board in board order, including soft-deleted ones. */
function listsOf(boardId: string) {
    return db
        .select()
        .from(lists)
        .where(eq(lists.boardId, boardId))
        .orderBy(lists.createdAt);
}

async function cardRow(cardId: string) {
    const [row] = await db.select().from(cards).where(eq(cards.id, cardId));
    return row;
}

describe('listBoards', () => {
    it('returns own boards ascending by createdAt with list and card counts', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const first = await seedBoard(a.id, 'First');
        const second = await seedBoard(a.id, 'Second');
        await seedBoard(b.id, 'Foreign');
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

    it('does not count deleted lists and cards', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        await addCard(a.id, todo.id, 'kept');
        const deleted = await addCard(a.id, todo.id, 'deleted');
        await addCard(a.id, done.id, 'in deleted list');
        await deleteCard(a.id, deleted!.id);
        await deleteList(a.id, done.id);

        expect(await listBoards(a.id)).toEqual([
            { id: board.id, title: 'Board', listCount: 1, cardCount: 1 },
        ]);
    });

    it('keeps a board whose lists are all deleted, with zero counts', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        await addCard(a.id, todo.id, 'card');
        await deleteList(a.id, todo.id);
        await deleteList(a.id, done.id);

        expect(await listBoards(a.id)).toEqual([
            { id: board.id, title: 'Board', listCount: 0, cardCount: 0 },
        ]);
    });

    it('returns an empty array for a user without boards', async () => {
        const a = await seedUser();

        expect(await listBoards(a.id)).toEqual([]);
    });
});

describe('createBoard', () => {
    it('creates an empty board with the given title', async () => {
        const a = await seedUser();

        const board = await createBoard(a.id, 'Roadmap');

        expect(board.title).toBe('Roadmap');
        expect(board.ownerId).toBe(a.id);
        expect(
            await db.select().from(lists).where(eq(lists.boardId, board.id)),
        ).toEqual([]);
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
        const board = await seedBoard(a.id, 'Old');

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
        const board = await seedBoard(a.id, 'Old');

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
        const board = await seedBoard(a.id, 'Doomed');
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
        const board = await seedBoard(a.id, 'Mine');

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
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');

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
        const board = await seedBoard(a.id, 'Board');

        const row = await addList(a.id, board.id, 'In progress');

        expect(row?.title).toBe('In progress');
        expect(row?.boardId).toBe(board.id);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await seedBoard(a.id, 'Board');

        const row = await addList(b.id, board.id, 'hacked');
        expect(row).toBeNull();
    });
});

describe('renameList', () => {
    it('renames a list on the owner board', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');
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
    it('soft deletes a list and leaves its cards untouched', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        const card = await addCard(a.id, list.id, 'card');

        const affected = await deleteList(a.id, list.id);
        expect(affected).toHaveLength(1);
        expect(affected[0].deletedAt).toBeInstanceOf(Date);

        expect((await cardRow(card!.id)).deletedAt).toBeNull();
    });

    it('hides the list and its cards from getBoard', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        await addCard(a.id, todo.id, 'card');

        await deleteList(a.id, todo.id);

        const result = await getBoard(a.id, board.id);
        expect(result?.lists.map((l) => l.id)).toEqual([done.id]);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);

        const affected = await deleteList(b.id, list.id);
        expect(affected).toHaveLength(0);
        expect((await listsOf(board.id))[0].deletedAt).toBeNull();
    });
});

describe('restoreList', () => {
    it('brings the list back with its cards in place', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        const card = await addCard(a.id, todo.id, 'card');
        await deleteList(a.id, todo.id);

        const affected = await restoreList(a.id, todo.id);
        expect(affected).toHaveLength(1);

        const result = await getBoard(a.id, board.id);
        expect(result?.lists.map((l) => l.id)).toEqual([todo.id, done.id]);
        expect(result?.lists[0].cards.map((c) => c.id)).toEqual([card!.id]);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        await deleteList(a.id, list.id);

        const affected = await restoreList(b.id, list.id);
        expect(affected).toHaveLength(0);
        expect((await listsOf(board.id))[0].deletedAt).toBeInstanceOf(Date);
    });
});

describe('mutations on a deleted list', () => {
    it('renameList is a no-op', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        await deleteList(a.id, list.id);

        expect(await renameList(a.id, list.id, 'renamed')).toHaveLength(0);
        expect((await listsOf(board.id))[0].title).toBe('To do');
    });

    it('addCard is a no-op', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        await deleteList(a.id, list.id);

        expect(await addCard(a.id, list.id, 'card')).toBeNull();
        expect(
            await db.select().from(cards).where(eq(cards.listId, list.id)),
        ).toHaveLength(0);
    });

    it('moveCard into a deleted list is a no-op', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        const card = await addCard(a.id, todo.id, 'card');
        await deleteList(a.id, done.id);

        expect(await moveCard(a.id, card!.id, done.id)).toBeNull();
        expect((await cardRow(card!.id)).listId).toBe(todo.id);
    });

    it('moveCard out of a deleted list is a no-op', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        const card = await addCard(a.id, todo.id, 'card');
        await deleteList(a.id, todo.id);

        expect(await moveCard(a.id, card!.id, done.id)).toBeNull();
        expect((await cardRow(card!.id)).listId).toBe(todo.id);
    });
});

describe('addCard', () => {
    it('adds a card to a list on the owner board', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');
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
        const board = await seedBoard(a.id, 'Board');
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
    it('soft deletes a card for the owner and hides it from getBoard', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        const kept = await addCard(a.id, list.id, 'kept');
        const card = await addCard(a.id, list.id, 'card');

        const affected = await deleteCard(a.id, card!.id);
        expect(affected).toHaveLength(1);
        expect(affected[0].deletedAt).toBeInstanceOf(Date);

        const result = await getBoard(a.id, board.id);
        expect(result?.lists[0].cards.map((c) => c.id)).toEqual([kept!.id]);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        const card = await addCard(a.id, list.id, 'card');

        const affected = await deleteCard(b.id, card!.id);
        expect(affected).toHaveLength(0);
        expect((await cardRow(card!.id)).deletedAt).toBeNull();
    });
});

describe('restoreCard', () => {
    it('brings the card back for the owner', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        const card = await addCard(a.id, list.id, 'card');
        await deleteCard(a.id, card!.id);

        const affected = await restoreCard(a.id, card!.id);
        expect(affected).toHaveLength(1);

        const result = await getBoard(a.id, board.id);
        expect(result?.lists[0].cards.map((c) => c.id)).toEqual([card!.id]);
    });

    it('is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        const card = await addCard(a.id, list.id, 'card');
        await deleteCard(a.id, card!.id);

        const affected = await restoreCard(b.id, card!.id);
        expect(affected).toHaveLength(0);
        expect((await cardRow(card!.id)).deletedAt).toBeInstanceOf(Date);
    });
});

describe('mutations on a deleted card', () => {
    it('updateCard is a no-op', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [list] = await listsOf(board.id);
        const card = await addCard(a.id, list.id, 'original');
        await deleteCard(a.id, card!.id);

        expect(
            await updateCard(a.id, card!.id, { title: 'renamed' }),
        ).toHaveLength(0);
        expect((await cardRow(card!.id)).title).toBe('original');
    });

    it('moveCard is a no-op', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        const card = await addCard(a.id, todo.id, 'card');
        await deleteCard(a.id, card!.id);

        expect(await moveCard(a.id, card!.id, done.id)).toBeNull();
        expect((await cardRow(card!.id)).listId).toBe(todo.id);
    });
});
