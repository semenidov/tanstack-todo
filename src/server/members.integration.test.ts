import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#/db';
import { boardMembers } from '#/db/schema';
import { requireUser } from '#/lib/auth-server';
import { Action } from '#/lib/permissions';
import { seedUser } from '#/test/db';
import {
    authorizeBoard,
    BOARD_ACCESS_DENIED,
    requireAffected,
} from './authorize';
import * as boards from './boards-repo';
import { renameBoardServer, deleteBoardServer } from './boards';
import { leaveBoardServer } from './members';
import { leaveBoard } from './members-repo';

vi.mock('#/lib/auth-server', () => ({ requireUser: vi.fn() }));
// Exercise the real handlers and database without the HTTP request context.
vi.mock('@tanstack/react-start', () => ({
    createServerFn: () => ({
        validator: () => ({
            handler: (handler: (input: unknown) => unknown) => handler,
        }),
        handler: (handler: (input: unknown) => unknown) => handler,
    }),
}));

async function fixture() {
    const owner = await seedUser();
    const member = await seedUser();
    const other = await seedUser();
    const board = await boards.createBoard(owner.id, 'Shared');
    await db.insert(boardMembers).values([
        { boardId: board.id, userId: member.id },
        { boardId: board.id, userId: other.id },
    ]);
    return { owner, member, other, board };
}

beforeEach(() => vi.clearAllMocks());

describe('board management handlers', () => {
    it('denies direct member rename and delete, preserving the board', async () => {
        const { owner, member, board } = await fixture();
        vi.mocked(requireUser).mockResolvedValue({
            ...member,
            isAnonymous: false,
        });
        await expect(
            renameBoardServer({ data: { boardId: board.id, title: 'Denied' } }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            deleteBoardServer({ data: { boardId: board.id } }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        expect(
            (
                await boards.getBoard(
                    await authorizeBoard(owner, board.id, Action.BoardRead),
                )
            )?.board.title,
        ).toBe('Shared');
    });

    it('removes only the acting member and immediately denies further access', async () => {
        const { owner, member, other, board } = await fixture();
        vi.mocked(requireUser).mockResolvedValue({
            ...member,
            isAnonymous: false,
        });
        await leaveBoardServer({ data: { boardId: board.id } });
        expect(await boards.listBoards(member.id)).toEqual([]);
        expect(await boards.listBoards(other.id)).toHaveLength(1);
        expect(await boards.listBoards(owner.id)).toHaveLength(1);
        await expect(
            authorizeBoard(member, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            leaveBoardServer({ data: { boardId: board.id } }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('denies Leave for the owner, outsiders and missing boards', async () => {
        const { owner, board } = await fixture();
        for (const user of [owner, await seedUser()]) {
            vi.mocked(requireUser).mockResolvedValue({
                ...user,
                isAnonymous: false,
            });
            await expect(
                leaveBoardServer({ data: { boardId: board.id } }),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
            await expect(
                leaveBoardServer({ data: { boardId: crypto.randomUUID() } }),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
        }
        expect(await db.select().from(boardMembers)).toHaveLength(2);
        expect(await boards.listBoards(owner.id)).toHaveLength(1);
    });

    it('rejects a stale pass when membership has already been removed', async () => {
        const { member, board } = await fixture();
        const access = await authorizeBoard(
            member,
            board.id,
            Action.BoardLeave,
        );
        requireAffected(await leaveBoard(access));
        await expect(leaveBoard(access).then(requireAffected)).rejects.toThrow(
            BOARD_ACCESS_DENIED,
        );
    });
});
