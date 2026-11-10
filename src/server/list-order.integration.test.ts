import { repoAccess } from '#/test/access';
import { authorizeBoard } from '#/server/authorize';
import { Action } from '#/lib/permissions';
import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import { boardMembers, cards, lists } from '#/db/schema';
import {
    addCard,
    addList,
    createBoard,
    deleteBoard,
    deleteCard,
    deleteList,
    getBoard,
    moveList,
    restoreList,
} from '#/server/boards-repo';
import { seedBoardMember, seedUser } from '#/test/db';
import { asc, eq } from 'drizzle-orm';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

/** A board of the user with lists inserted at the given keys; ids in insert order. */
async function seedLists(userId: string, keys: Array<string>) {
    const board = await createBoard(userId, 'Board');
    const ids: Array<string> = [];
    for (const [i, position] of keys.entries()) {
        const [row] = await db
            .insert(lists)
            .values({ boardId: board.id, title: `list ${i}`, position })
            .returning();
        ids.push(row.id);
    }
    return { board, ids };
}

/** List ids of the board in getBoard order. */
async function listOrder(userId: string, boardId: string) {
    const result = await getBoard(
        await authorizeBoard(userId, boardId, Action.BoardRead),
    );
    return result?.lists.map((l) => l.id) ?? [];
}

async function listRow(listId: string) {
    const [row] = await db.select().from(lists).where(eq(lists.id, listId));
    return row;
}

function cardsOf(listId: string) {
    return db
        .select()
        .from(cards)
        .where(eq(cards.listId, listId))
        .orderBy(asc(cards.id));
}

describe('list order', () => {
    it('getBoard orders lists by position byte-wise: Zz before a0', async () => {
        const a = await seedUser();
        const { board, ids } = await seedLists(a.id, ['a0', 'Zz', 'a1']);

        expect(await listOrder(a.id, board.id)).toEqual([
            ids[1],
            ids[0],
            ids[2],
        ]);
    });

    it('addList puts the new list after the last one, deleted included', async () => {
        const a = await seedUser();
        const { board, ids } = await seedLists(a.id, ['a0', 'a1']);
        await deleteList(await repoAccess(a.id, ids[1]), ids[1]);

        const added = await addList(
            await repoAccess(a.id, board.id),
            board.id,
            'new',
        );
        await restoreList(await repoAccess(a.id, ids[1]), ids[1]);

        expect(await listOrder(a.id, board.id)).toEqual([
            ids[0],
            ids[1],
            added?.id,
        ]);
    });

    it('addList gives the first list of an empty board the key a0', async () => {
        const a = await seedUser();
        const board = await createBoard(a.id, 'Board');

        const added = await addList(
            await repoAccess(a.id, board.id),
            board.id,
            'first',
        );
        expect(added?.position).toBe('a0');
    });
});

describe('moveList', () => {
    it('repository checks membership at both ends, including a stale target pass', async () => {
        const owner = await seedUser();
        const editor = await seedUser();
        const source = await seedLists(owner.id, ['a0', 'a1']);
        const target = await seedLists(owner.id, ['a0']);
        await seedBoardMember(source.board.id, editor.id);
        await seedBoardMember(target.board.id, editor.id);
        const sourcePass = await authorizeBoard(
            editor.id,
            source.board.id,
            Action.ContentEdit,
        );
        const targetPass = await authorizeBoard(
            editor.id,
            target.board.id,
            Action.BoardRead,
        );

        expect(
            await moveList(
                sourcePass,
                source.ids[0],
                targetPass,
                null,
                target.ids[0],
            ),
        ).not.toBeNull();
        await db
            .delete(boardMembers)
            .where(eq(boardMembers.boardId, target.board.id));
        expect(
            await moveList(sourcePass, source.ids[1], targetPass, null, null),
        ).toBeNull();
        expect((await listRow(source.ids[1])).boardId).toBe(source.board.id);
    });

    it('moves a list to the end, to the start and between two lists', async () => {
        const a = await seedUser();
        const { board, ids } = await seedLists(a.id, ['a0', 'a1', 'a2']);
        const [x, y, z] = ids;

        expect(
            await moveList(
                await repoAccess(a.id, x),
                x,
                await repoAccess(a.id, board.id),
                z,
                null,
            ),
        ).not.toBeNull();
        expect(await listOrder(a.id, board.id)).toEqual([y, z, x]);

        await moveList(
            await repoAccess(a.id, x),
            x,
            await repoAccess(a.id, board.id),
            null,
            y,
        );
        expect(await listOrder(a.id, board.id)).toEqual([x, y, z]);

        await moveList(
            await repoAccess(a.id, z),
            z,
            await repoAccess(a.id, board.id),
            x,
            y,
        );
        expect(await listOrder(a.id, board.id)).toEqual([x, z, y]);
    });

    it('moves a list to another board with all its cards in order, deleted ones included', async () => {
        const a = await seedUser();
        const source = await seedLists(a.id, ['a0', 'a1']);
        const target = await seedLists(a.id, ['a0', 'a1']);
        const [moving, staying] = source.ids;
        const first = await addCard(
            await repoAccess(a.id, moving),
            moving,
            'first',
        );
        const deleted = await addCard(
            await repoAccess(a.id, moving),
            moving,
            'deleted',
        );
        const last = await addCard(
            await repoAccess(a.id, moving),
            moving,
            'last',
        );
        await deleteCard(await repoAccess(a.id, deleted!.id), deleted!.id);
        const cardsBefore = await cardsOf(moving);

        const row = await moveList(
            await repoAccess(a.id, moving),
            moving,
            await repoAccess(a.id, target.board.id),
            target.ids[0],
            target.ids[1],
        );

        expect(row?.boardId).toBe(target.board.id);
        expect(await listOrder(a.id, source.board.id)).toEqual([staying]);
        expect(await listOrder(a.id, target.board.id)).toEqual([
            target.ids[0],
            moving,
            target.ids[1],
        ]);
        const result = await getBoard(
            await authorizeBoard(a.id, target.board.id, Action.BoardRead),
        );
        expect(result?.lists[1].cards.map((c) => c.id)).toEqual([
            last!.id,
            first!.id,
        ]);
        // The cards rows are untouched: same list, keys and deletedAt.
        expect(await cardsOf(moving)).toEqual(cardsBefore);
    });

    it('moves a list onto an empty board', async () => {
        const a = await seedUser();
        const source = await seedLists(a.id, ['a0']);
        const target = await createBoard(a.id, 'Empty');

        const row = await moveList(
            await repoAccess(a.id, source.ids[0]),
            source.ids[0],
            await repoAccess(a.id, target.id),
            null,
            null,
        );
        expect(row?.boardId).toBe(target.id);
        expect(await listOrder(a.id, target.id)).toEqual([source.ids[0]]);
    });

    describe('refuses and leaves the data as is', () => {
        async function expectRefused(
            listId: string,
            move: () => Promise<unknown>,
        ) {
            const before = await listRow(listId);
            expect(await move()).toBeNull();
            const after = await listRow(listId);
            expect([after.boardId, after.position]).toEqual([
                before.boardId,
                before.position,
            ]);
        }

        it('a neighbor not on the target board', async () => {
            const a = await seedUser();
            const source = await seedLists(a.id, ['a0', 'a1']);
            const target = await seedLists(a.id, ['a0']);
            const [moving, sourceNeighbor] = source.ids;

            await expectRefused(moving, async () =>
                moveList(
                    await repoAccess(a.id, moving),
                    moving,
                    await repoAccess(a.id, target.board.id),
                    sourceNeighbor,
                    null,
                ),
            );
            await expectRefused(moving, async () =>
                moveList(
                    await repoAccess(a.id, moving),
                    moving,
                    await repoAccess(a.id, source.board.id),
                    target.ids[0],
                    null,
                ),
            );
        });

        it('a deleted neighbor', async () => {
            const a = await seedUser();
            const { board, ids } = await seedLists(a.id, ['a0', 'a1', 'a2']);
            await deleteList(await repoAccess(a.id, ids[2]), ids[2]);

            await expectRefused(ids[0], async () =>
                moveList(
                    await repoAccess(a.id, ids[0]),
                    ids[0],
                    await repoAccess(a.id, board.id),
                    ids[2],
                    null,
                ),
            );
        });

        it('the list itself as a neighbor, or one list on both sides', async () => {
            const a = await seedUser();
            const { board, ids } = await seedLists(a.id, ['a0', 'a1']);

            await expectRefused(ids[0], async () =>
                moveList(
                    await repoAccess(a.id, ids[0]),
                    ids[0],
                    await repoAccess(a.id, board.id),
                    ids[0],
                    null,
                ),
            );
            await expectRefused(ids[0], async () =>
                moveList(
                    await repoAccess(a.id, ids[0]),
                    ids[0],
                    await repoAccess(a.id, board.id),
                    null,
                    ids[0],
                ),
            );
            await expectRefused(ids[0], async () =>
                moveList(
                    await repoAccess(a.id, ids[0]),
                    ids[0],
                    await repoAccess(a.id, board.id),
                    ids[1],
                    ids[1],
                ),
            );
        });

        it('a list of another user', async () => {
            const a = await seedUser();
            const b = await seedUser();
            const foreign = await seedLists(b.id, ['a0', 'a1']);
            const mine = await createBoard(a.id, 'Mine');

            await expectRefused(foreign.ids[0], async () =>
                moveList(
                    await repoAccess(a.id, foreign.ids[0]),
                    foreign.ids[0],
                    await repoAccess(a.id, foreign.board.id),
                    foreign.ids[1],
                    null,
                ),
            );
            await expectRefused(foreign.ids[0], async () =>
                moveList(
                    await repoAccess(a.id, foreign.ids[0]),
                    foreign.ids[0],
                    await repoAccess(a.id, mine.id),
                    null,
                    null,
                ),
            );
        });

        it('a target board of another user', async () => {
            const a = await seedUser();
            const b = await seedUser();
            const mine = await seedLists(a.id, ['a0']);
            const foreign = await seedLists(b.id, ['a0']);

            await expectRefused(mine.ids[0], async () =>
                moveList(
                    await repoAccess(a.id, mine.ids[0]),
                    mine.ids[0],
                    await repoAccess(a.id, foreign.board.id),
                    null,
                    null,
                ),
            );
            await expectRefused(mine.ids[0], async () =>
                moveList(
                    await repoAccess(a.id, mine.ids[0]),
                    mine.ids[0],
                    await repoAccess(a.id, foreign.board.id),
                    foreign.ids[0],
                    null,
                ),
            );
            expect(await listOrder(b.id, foreign.board.id)).toEqual(
                foreign.ids,
            );
        });

        it('a deleted or missing target board', async () => {
            const a = await seedUser();
            const mine = await seedLists(a.id, ['a0']);
            const gone = await createBoard(a.id, 'Gone');
            await deleteBoard(await repoAccess(a.id, gone.id), gone.id);

            await expectRefused(mine.ids[0], async () =>
                moveList(
                    await repoAccess(a.id, mine.ids[0]),
                    mine.ids[0],
                    await repoAccess(a.id, gone.id),
                    null,
                    null,
                ),
            );
            await expectRefused(mine.ids[0], async () =>
                moveList(
                    await repoAccess(a.id, mine.ids[0]),
                    mine.ids[0],
                    await repoAccess(a.id, MISSING_ID),
                    null,
                    null,
                ),
            );
        });

        it('a deleted list', async () => {
            const a = await seedUser();
            const { board, ids } = await seedLists(a.id, ['a0', 'a1']);
            await deleteList(await repoAccess(a.id, ids[0]), ids[0]);

            await expectRefused(ids[0], async () =>
                moveList(
                    await repoAccess(a.id, ids[0]),
                    ids[0],
                    await repoAccess(a.id, board.id),
                    ids[1],
                    null,
                ),
            );
        });
    });

    it('renumbers the target board when the neighbors have equal keys and moves the list', async () => {
        const a = await seedUser();
        const source = await seedLists(a.id, ['a0']);
        const target = await seedLists(a.id, ['a0', 'a1', 'a1', 'a2']);
        const [, first, second] = await listOrder(a.id, target.board.id);

        const row = await moveList(
            await repoAccess(a.id, source.ids[0]),
            source.ids[0],
            await repoAccess(a.id, target.board.id),
            first,
            second,
        );

        expect(row).not.toBeNull();
        const order = await listOrder(a.id, target.board.id);
        expect(order).toEqual([
            target.ids[0],
            first,
            source.ids[0],
            second,
            target.ids[3],
        ]);
        const positions = await Promise.all(
            order.map(async (id) => (await listRow(id)).position),
        );
        expect(new Set(positions).size).toBe(positions.length);
    });

    it('renumbering keeps deleted lists in their place', async () => {
        const a = await seedUser();
        const { board, ids } = await seedLists(a.id, ['a0', 'a1', 'a1', 'a2']);
        await deleteList(await repoAccess(a.id, ids[0]), ids[0]);
        const [first, second, last] = await listOrder(a.id, board.id);

        await moveList(
            await repoAccess(a.id, last),
            last,
            await repoAccess(a.id, board.id),
            first,
            second,
        );
        await restoreList(await repoAccess(a.id, ids[0]), ids[0]);

        expect(await listOrder(a.id, board.id)).toEqual([
            ids[0],
            first,
            last,
            second,
        ]);
    });

    it('Undo of a list delete returns it to its place after other lists moved', async () => {
        const a = await seedUser();
        const { board, ids } = await seedLists(a.id, ['a0', 'a1', 'a2', 'a3']);
        const [w, x, y, z] = ids;
        await deleteList(await repoAccess(a.id, x), x);

        await moveList(
            await repoAccess(a.id, z),
            z,
            await repoAccess(a.id, board.id),
            null,
            w,
        );
        await moveList(
            await repoAccess(a.id, w),
            w,
            await repoAccess(a.id, board.id),
            y,
            null,
        );
        await restoreList(await repoAccess(a.id, x), x);

        expect(await listOrder(a.id, board.id)).toEqual([z, x, y, w]);
    });
});
