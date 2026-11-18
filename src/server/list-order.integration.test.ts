import { repoAccess } from '#/test/access';
import { authorizeBoard } from '#/server/authorize';
import type { BoardAccess } from '#/server/authorize';
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
import { seedBoardMember, seedBoardWithAccess, seedUser } from '#/test/db';
import type { BoardFixtureOptions } from '#/test/db';
import { asc, eq } from 'drizzle-orm';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

async function seedLists(boardId: string, keys: Array<string>) {
    if (!keys.length) return [];
    const rows = await db
        .insert(lists)
        .values(
            keys.map((position, i) => ({
                boardId,
                title: `list ${i}`,
                position,
            })),
        )
        .returning({ id: lists.id });
    return rows.map((row) => row.id);
}

async function seedBoardWithLists(
    keys: Array<string>,
    options?: BoardFixtureOptions,
) {
    const { board, access } = await seedBoardWithAccess(options);
    const ids = await seedLists(board.id, keys);
    return { board, access, ids };
}

/** List ids of the board in getBoard order. */
async function listOrder(access: BoardAccess) {
    const result = await getBoard(access);
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
        const { access, ids } = await seedBoardWithLists(['a0', 'Zz', 'a1'], {
            action: Action.BoardRead,
        });

        expect(await listOrder(access)).toEqual([ids[1], ids[0], ids[2]]);
    });

    it('addList puts the new list after the last one, deleted included', async () => {
        const { access, ids } = await seedBoardWithLists(['a0', 'a1']);
        await deleteList(access, ids[1]);

        const added = await addList(access, 'new');
        await restoreList(access, ids[1]);

        expect(await listOrder(access)).toEqual([ids[0], ids[1], added?.id]);
    });

    it('adds the first list to an empty board', async () => {
        const { access } = await seedBoardWithAccess();

        const added = await addList(access, 'first');
        expect(added).toBeDefined();
        expect(await listOrder(access)).toEqual([added?.id]);
    });
});

describe('moveList', () => {
    it('repository checks membership at both ends, including a stale target pass', async () => {
        const owner = await seedUser();
        const editor = await seedUser();
        const source = await createBoard(owner.id, 'Board');
        const sourceIds = await seedLists(source.id, ['a0', 'a1']);
        const target = await createBoard(owner.id, 'Board');
        const targetIds = await seedLists(target.id, ['a0']);
        await seedBoardMember(source.id, editor.id);
        await seedBoardMember(target.id, editor.id);
        const sourcePass = await authorizeBoard(
            editor.id,
            source.id,
            Action.ContentEdit,
        );
        const targetPass = await authorizeBoard(
            editor.id,
            target.id,
            Action.BoardRead,
        );

        expect(
            await moveList(
                sourcePass,
                sourceIds[0],
                targetPass,
                null,
                targetIds[0],
            ),
        ).not.toBeNull();
        await db
            .delete(boardMembers)
            .where(eq(boardMembers.boardId, target.id));
        expect(
            await moveList(sourcePass, sourceIds[1], targetPass, null, null),
        ).toBeNull();
        expect((await listRow(sourceIds[1])).boardId).toBe(source.id);
    });

    it('moves a list to the end, to the start and between two lists', async () => {
        const { access, ids } = await seedBoardWithLists(['a0', 'a1', 'a2']);
        const [x, y, z] = ids;

        expect(await moveList(access, x, access, z, null)).not.toBeNull();
        expect(await listOrder(access)).toEqual([y, z, x]);

        await moveList(access, x, access, null, y);
        expect(await listOrder(access)).toEqual([x, y, z]);

        await moveList(access, z, access, x, y);
        expect(await listOrder(access)).toEqual([x, z, y]);
    });

    it('moves a list to another board with all its cards in order, deleted ones included', async () => {
        const source = await seedBoardWithLists(['a0', 'a1']);
        const target = await seedBoardWithLists(['a0', 'a1'], {
            ownerId: source.access.userId,
        });
        const [moving, staying] = source.ids;
        const first = await addCard(source.access, moving, 'first');
        const deleted = await addCard(source.access, moving, 'deleted');
        const last = await addCard(source.access, moving, 'last');
        await deleteCard(source.access, deleted!.id);
        const cardsBefore = await cardsOf(moving);

        const row = await moveList(
            source.access,
            moving,
            target.access,
            target.ids[0],
            target.ids[1],
        );

        expect(row?.boardId).toBe(target.board.id);
        expect(await listOrder(source.access)).toEqual([staying]);
        expect(await listOrder(target.access)).toEqual([
            target.ids[0],
            moving,
            target.ids[1],
        ]);
        const result = await getBoard(target.access);
        expect(result?.lists[1].cards.map((c) => c.id)).toEqual([
            last!.id,
            first!.id,
        ]);
        // The cards rows are untouched: same list, keys and deletedAt.
        expect(await cardsOf(moving)).toEqual(cardsBefore);
    });

    it('moves a list onto an empty board', async () => {
        const source = await seedBoardWithLists(['a0']);
        const { board: target, access: targetAccess } =
            await seedBoardWithAccess({
                ownerId: source.access.userId,
                title: 'Empty',
            });

        const row = await moveList(
            source.access,
            source.ids[0],
            targetAccess,
            null,
            null,
        );
        expect(row?.boardId).toBe(target.id);
        expect(await listOrder(targetAccess)).toEqual([source.ids[0]]);
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
            const source = await seedBoardWithLists(['a0', 'a1']);
            const target = await seedBoardWithLists(['a0'], {
                ownerId: source.access.userId,
            });
            const [moving, sourceNeighbor] = source.ids;

            await expectRefused(moving, () =>
                moveList(
                    source.access,
                    moving,
                    target.access,
                    sourceNeighbor,
                    null,
                ),
            );
            await expectRefused(moving, () =>
                moveList(
                    source.access,
                    moving,
                    source.access,
                    target.ids[0],
                    null,
                ),
            );
        });

        it('a deleted neighbor', async () => {
            const { access, ids } = await seedBoardWithLists([
                'a0',
                'a1',
                'a2',
            ]);
            await deleteList(access, ids[2]);

            await expectRefused(ids[0], () =>
                moveList(access, ids[0], access, ids[2], null),
            );
        });

        it('the list itself as a neighbor, or one list on both sides', async () => {
            const { access, ids } = await seedBoardWithLists(['a0', 'a1']);

            await expectRefused(ids[0], () =>
                moveList(access, ids[0], access, ids[0], null),
            );
            await expectRefused(ids[0], () =>
                moveList(access, ids[0], access, null, ids[0]),
            );
            await expectRefused(ids[0], () =>
                moveList(access, ids[0], access, ids[1], ids[1]),
            );
        });

        it('a list of another user', async () => {
            const { access } = await seedBoardWithAccess({ title: 'Mine' });
            const foreign = await seedBoardWithLists(['a0', 'a1']);
            const foreignAccess = { ...foreign.access, userId: access.userId };

            await expectRefused(foreign.ids[0], () =>
                moveList(
                    foreignAccess,
                    foreign.ids[0],
                    foreignAccess,
                    foreign.ids[1],
                    null,
                ),
            );
            await expectRefused(foreign.ids[0], () =>
                moveList(foreignAccess, foreign.ids[0], access, null, null),
            );
        });

        it('a target board of another user', async () => {
            const { access, ids } = await seedBoardWithLists(['a0']);
            const foreign = await seedBoardWithLists(['a0'], {
                action: Action.BoardRead,
            });
            const foreignAccess = { ...foreign.access, userId: access.userId };

            await expectRefused(ids[0], () =>
                moveList(access, ids[0], foreignAccess, null, null),
            );
            await expectRefused(ids[0], () =>
                moveList(access, ids[0], foreignAccess, foreign.ids[0], null),
            );
            expect(await listOrder(foreign.access)).toEqual(foreign.ids);
        });

        it('a deleted or missing target board', async () => {
            const { access, ids } = await seedBoardWithLists(['a0']);
            const { access: goneAccess } = await seedBoardWithAccess({
                ownerId: access.userId,
                title: 'Gone',
            });
            await deleteBoard(goneAccess);
            const missingAccess = await repoAccess(access.userId, MISSING_ID);

            await expectRefused(ids[0], () =>
                moveList(access, ids[0], goneAccess, null, null),
            );
            await expectRefused(ids[0], () =>
                moveList(access, ids[0], missingAccess, null, null),
            );
        });

        it('a deleted list', async () => {
            const { access, ids } = await seedBoardWithLists(['a0', 'a1']);
            await deleteList(access, ids[0]);

            await expectRefused(ids[0], () =>
                moveList(access, ids[0], access, ids[1], null),
            );
        });
    });

    it('renumbers the target board when the neighbors have equal keys and moves the list', async () => {
        const source = await seedBoardWithLists(['a0']);
        const target = await seedBoardWithLists(['a0', 'a1', 'a1', 'a2'], {
            ownerId: source.access.userId,
        });
        const [, first, second] = await listOrder(target.access);

        const row = await moveList(
            source.access,
            source.ids[0],
            target.access,
            first,
            second,
        );

        expect(row).not.toBeNull();
        const order = await listOrder(target.access);
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
        const { access, ids } = await seedBoardWithLists([
            'a0',
            'a1',
            'a1',
            'a2',
        ]);
        await deleteList(access, ids[0]);
        const [first, second, last] = await listOrder(access);

        await moveList(access, last, access, first, second);
        await restoreList(access, ids[0]);

        expect(await listOrder(access)).toEqual([ids[0], first, last, second]);
    });

    it('Undo of a list delete returns it to its place after other lists moved', async () => {
        const { access, ids } = await seedBoardWithLists([
            'a0',
            'a1',
            'a2',
            'a3',
        ]);
        const [w, x, y, z] = ids;
        await deleteList(access, x);

        await moveList(access, z, access, null, w);
        await moveList(access, w, access, y, null);
        await restoreList(access, x);

        expect(await listOrder(access)).toEqual([z, x, y, w]);
    });
});
