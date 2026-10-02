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

        expect(await moveCard(a.id, card!.id, done.id, null, null)).toBeNull();
        expect((await cardRow(card!.id)).listId).toBe(todo.id);
    });

    it('moveCard out of a deleted list is a no-op', async () => {
        const a = await seedUser();
        const board = await seedBoard(a.id, 'Board');
        const [todo, done] = await listsOf(board.id);
        const card = await addCard(a.id, todo.id, 'card');
        await deleteList(a.id, todo.id);

        expect(await moveCard(a.id, card!.id, done.id, null, null)).toBeNull();
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

        const row = await moveCard(a.id, card!.id, toList.id, null, null);
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

        const row = await moveCard(b.id, card!.id, toList.id, null, null);
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

        const row = await moveCard(a.id, card!.id, otherList.id, null, null);
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

        expect(await moveCard(a.id, card!.id, done.id, null, null)).toBeNull();
        expect((await cardRow(card!.id)).listId).toBe(todo.id);
    });
});

describe('card order', () => {
    /** A board with «To do» and «Done»; cards inserted with the given keys. */
    async function seedOrder(
        userId: string,
        todoKeys: Array<string>,
        doneKeys: Array<string> = [],
    ) {
        const board = await seedBoard(userId, 'Board');
        const [todo, done] = await listsOf(board.id);
        const insert = async (listId: string, keys: Array<string>) => {
            const ids: Array<string> = [];
            for (const [i, position] of keys.entries()) {
                const [row] = await db
                    .insert(cards)
                    .values({ listId, title: `card ${i}`, position })
                    .returning();
                ids.push(row.id);
            }
            return ids;
        };
        return {
            board,
            todo,
            done,
            todoIds: await insert(todo.id, todoKeys),
            doneIds: await insert(done.id, doneKeys),
        };
    }

    /** Card ids per list in getBoard order: [todo, done]. */
    async function order(userId: string, boardId: string) {
        const result = await getBoard(userId, boardId);
        return result?.lists.map((l) => l.cards.map((c) => c.id)) ?? [];
    }

    it('getBoard orders cards by position byte-wise: Zz before a0', async () => {
        const a = await seedUser();
        const { board, todoIds } = await seedOrder(a.id, ['a0', 'b0', 'Zz']);

        expect((await order(a.id, board.id))[0]).toEqual([
            todoIds[2],
            todoIds[0],
            todoIds[1],
        ]);
    });

    it('addCard puts the new card before the first live card', async () => {
        const a = await seedUser();
        const { board, todo, todoIds } = await seedOrder(a.id, ['a0', 'a1']);
        await deleteCard(a.id, todoIds[0]);

        const card = await addCard(a.id, todo.id, 'new');

        expect(card?.position).toBe('a0');
        expect((await order(a.id, board.id))[0]).toEqual([
            card!.id,
            todoIds[1],
        ]);
    });

    it('addCard gives the first card of an empty list the key a0', async () => {
        const a = await seedUser();
        const { todo } = await seedOrder(a.id, []);

        expect((await addCard(a.id, todo.id, 'first'))?.position).toBe('a0');
    });

    it('moveCard puts a card between two neighbors in another list', async () => {
        const a = await seedUser();
        const { board, done, todoIds, doneIds } = await seedOrder(
            a.id,
            ['a0'],
            ['a0', 'a1'],
        );

        const row = await moveCard(
            a.id,
            todoIds[0],
            done.id,
            doneIds[0],
            doneIds[1],
        );

        expect(row?.listId).toBe(done.id);
        expect(await order(a.id, board.id)).toEqual([
            [],
            [doneIds[0], todoIds[0], doneIds[1]],
        ]);
    });

    it('moveCard puts a card at the start and at the end of a list', async () => {
        const a = await seedUser();
        const { board, todo, todoIds } = await seedOrder(a.id, [
            'a0',
            'a1',
            'a2',
        ]);

        await moveCard(a.id, todoIds[2], todo.id, null, todoIds[0]);
        expect((await order(a.id, board.id))[0]).toEqual([
            todoIds[2],
            todoIds[0],
            todoIds[1],
        ]);

        await moveCard(a.id, todoIds[2], todo.id, todoIds[1], null);
        expect((await order(a.id, board.id))[0]).toEqual(todoIds);
    });

    it('moveCard moves a card down and up inside its list', async () => {
        const a = await seedUser();
        const { board, todo, todoIds } = await seedOrder(a.id, [
            'a0',
            'a1',
            'a2',
        ]);

        await moveCard(a.id, todoIds[0], todo.id, todoIds[1], todoIds[2]);
        expect((await order(a.id, board.id))[0]).toEqual([
            todoIds[1],
            todoIds[0],
            todoIds[2],
        ]);

        await moveCard(a.id, todoIds[2], todo.id, null, todoIds[1]);
        expect((await order(a.id, board.id))[0]).toEqual([
            todoIds[2],
            todoIds[1],
            todoIds[0],
        ]);
    });

    it('moveCard puts a card into an empty list', async () => {
        const a = await seedUser();
        const { board, done, todoIds } = await seedOrder(a.id, ['a0']);

        const row = await moveCard(a.id, todoIds[0], done.id, null, null);

        expect(row?.position).toBe('a0');
        expect(await order(a.id, board.id)).toEqual([[], [todoIds[0]]]);
    });

    describe('refuses bad neighbors and leaves the data as is', () => {
        async function expectRefused(
            cardId: string,
            move: () => Promise<unknown>,
        ) {
            const before = await cardRow(cardId);
            expect(await move()).toBeNull();
            const after = await cardRow(cardId);
            expect([after.listId, after.position]).toEqual([
                before.listId,
                before.position,
            ]);
        }

        it('a neighbor from another list', async () => {
            const a = await seedUser();
            const { done, todoIds } = await seedOrder(
                a.id,
                ['a0', 'a1'],
                ['a0'],
            );

            await expectRefused(todoIds[0], () =>
                moveCard(a.id, todoIds[0], done.id, todoIds[1], null),
            );
            await expectRefused(todoIds[0], () =>
                moveCard(a.id, todoIds[0], done.id, null, todoIds[1]),
            );
        });

        it('a neighbor from another user board', async () => {
            const a = await seedUser();
            const b = await seedUser();
            const mine = await seedOrder(a.id, ['a0']);
            const foreign = await seedOrder(b.id, ['a0']);

            await expectRefused(mine.todoIds[0], () =>
                moveCard(
                    a.id,
                    mine.todoIds[0],
                    mine.done.id,
                    foreign.todoIds[0],
                    null,
                ),
            );
            await expectRefused(mine.todoIds[0], () =>
                moveCard(
                    a.id,
                    mine.todoIds[0],
                    foreign.todo.id,
                    foreign.todoIds[0],
                    null,
                ),
            );
        });

        it('a deleted neighbor', async () => {
            const a = await seedUser();
            const { done, todoIds, doneIds } = await seedOrder(
                a.id,
                ['a0'],
                ['a0'],
            );
            await deleteCard(a.id, doneIds[0]);

            await expectRefused(todoIds[0], () =>
                moveCard(a.id, todoIds[0], done.id, doneIds[0], null),
            );
        });

        it('the card itself as a neighbor', async () => {
            const a = await seedUser();
            const { todo, todoIds } = await seedOrder(a.id, ['a0', 'a1']);

            await expectRefused(todoIds[0], () =>
                moveCard(a.id, todoIds[0], todo.id, todoIds[0], todoIds[1]),
            );
            await expectRefused(todoIds[0], () =>
                moveCard(a.id, todoIds[0], todo.id, null, todoIds[0]),
            );
        });

        it('a deleted target list', async () => {
            const a = await seedUser();
            const { done, todoIds } = await seedOrder(a.id, ['a0']);
            await deleteList(a.id, done.id);

            await expectRefused(todoIds[0], () =>
                moveCard(a.id, todoIds[0], done.id, null, null),
            );
        });
    });

    it('renumbers the list when the neighbors have equal keys and moves the card', async () => {
        const a = await seedUser();
        const { board, done, todoIds, doneIds } = await seedOrder(
            a.id,
            ['a0'],
            ['a0', 'a1', 'a1', 'a2'],
        );
        const [, first, second] = (await order(a.id, board.id))[1];

        const row = await moveCard(a.id, todoIds[0], done.id, first, second);

        expect(row).not.toBeNull();
        const doneOrder = (await order(a.id, board.id))[1];
        expect(doneOrder).toEqual([
            doneIds[0],
            first,
            todoIds[0],
            second,
            doneIds[3],
        ]);
        const positions = await Promise.all(
            doneOrder.map(async (id) => (await cardRow(id)).position),
        );
        expect(new Set(positions).size).toBe(positions.length);
    });

    it('renumbering keeps deleted cards in their place', async () => {
        const a = await seedUser();
        const { board, done, todoIds, doneIds } = await seedOrder(
            a.id,
            ['a0'],
            ['a0', 'a1', 'a1'],
        );
        await deleteCard(a.id, doneIds[0]);
        const [first, second] = (await order(a.id, board.id))[1];

        await moveCard(a.id, todoIds[0], done.id, first, second);
        await restoreCard(a.id, doneIds[0]);

        expect((await order(a.id, board.id))[1]).toEqual([
            doneIds[0],
            first,
            todoIds[0],
            second,
        ]);
    });

    it('Undo of a delete returns the card to its place after the neighbors moved', async () => {
        const a = await seedUser();
        const { board, todo, todoIds, doneIds } = await seedOrder(
            a.id,
            ['a0', 'a1', 'a2'],
            ['a0'],
        );
        const [first, middle, last] = todoIds;
        await deleteCard(a.id, middle);
        // Without the deleted card, first and last are neighbors: the key lands
        // between them, so the deleted card may share it.
        const moved = await moveCard(a.id, doneIds[0], todo.id, first, last);
        await restoreCard(a.id, middle);

        expect(moved).not.toBeNull();
        const todoOrder = (await order(a.id, board.id))[0];
        expect(todoOrder[0]).toBe(first);
        expect(todoOrder.slice(1, 3).sort()).toEqual(
            [middle, doneIds[0]].sort(),
        );
        expect(todoOrder[3]).toBe(last);

        // A move between cards that may share a key still lands exactly there.
        const [, upper, lower] = todoOrder;
        await moveCard(a.id, last, todo.id, upper, lower);
        expect((await order(a.id, board.id))[0]).toEqual([
            first,
            upper,
            last,
            lower,
        ]);
    });
});
