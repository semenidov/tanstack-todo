import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers } from '#/db/schema';
import { seedUser, seedBoardMember } from '#/test/db';
import { Action, BOARD_ACCESS_DENIED } from '#/lib/permissions';
import { authorizeBoard } from './authorize';
import { createBoard, getBoard, listBoards } from './boards-repo';
import {
    getSharing,
    leaveBoard,
    removeMember,
    shareBoard,
} from './members-repo';
import {
    leaveBoardServer,
    getSharingServer,
    shareBoardServer,
    removeMemberServer,
} from './members';
import { renameBoardServer, deleteBoardServer } from './boards';

const auth = vi.hoisted(() => ({ userId: '' }));
vi.mock('#/lib/auth-server', () => ({
    requireUser: async () => ({ id: auth.userId }),
}));
// Exercise server handlers directly without HTTP/session middleware.
vi.mock('@tanstack/react-start', () => ({
    createServerFn: () => ({
        validator: () => ({
            handler: (fn: (args: { data: unknown }) => unknown) => fn,
        }),
        handler: (fn: () => unknown) => fn,
    }),
}));

beforeEach(() => {
    auth.userId = '';
});

async function fixture() {
    const owner = await seedUser();
    const editor = await seedUser();
    const stranger = await seedUser();
    const board = await createBoard(owner.id, 'Shared');
    await seedBoardMember(board.id, editor.id);
    return { owner, editor, stranger, board };
}

describe('board management and leaving', () => {
    it('rejects editor and stranger direct rename/delete calls; owner can manage', async () => {
        const { owner, editor, stranger, board } = await fixture();
        for (const person of [editor, stranger]) {
            auth.userId = person.id;
            await expect(
                renameBoardServer({
                    data: { boardId: board.id, title: 'Changed' },
                }),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
            await expect(
                deleteBoardServer({ data: { boardId: board.id } }),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
        }
        auth.userId = owner.id;
        await renameBoardServer({
            data: { boardId: board.id, title: 'Renamed' },
        });
        expect(
            (
                await getBoard(
                    await authorizeBoard(owner.id, board.id, Action.BoardRead),
                )
            )?.board.title,
        ).toBe('Renamed');
        await deleteBoardServer({ data: { boardId: board.id } });
        expect(await listBoards(owner.id)).toEqual([]);
    });

    it('an editor loses read access after leaving', async () => {
        const { editor, board } = await fixture();
        auth.userId = editor.id;

        await leaveBoardServer({ data: { boardId: board.id } });

        await expect(
            authorizeBoard(editor.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('the board owner cannot leave their own board', async () => {
        const { owner, board } = await fixture();
        auth.userId = owner.id;

        await expect(
            leaveBoardServer({ data: { boardId: board.id } }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('a stale leave pass cannot remove another membership', async () => {
        const { editor, stranger, board } = await fixture();
        await seedBoardMember(board.id, stranger.id);
        const pass = await authorizeBoard(
            editor.id,
            board.id,
            Action.BoardLeave,
        );
        await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));
        expect(await leaveBoard(pass)).toEqual([]);
        expect(await listBoards(stranger.id)).toHaveLength(1);
    });
});

describe('owner sharing management', () => {
    it('repository checks membership after the role gate, including stale passes', async () => {
        const { editor, stranger, board } = await fixture();
        await seedBoardMember(board.id, stranger.id);
        const pass = await authorizeBoard(
            editor.id,
            board.id,
            Action.BoardRead,
        );
        expect((await getSharing(pass))?.members).toHaveLength(2);
        expect(await shareBoard(pass, 'token', false)).toHaveLength(1);
        expect(await removeMember(pass, stranger.id)).toHaveLength(1);

        await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));
        expect(await getSharing(pass)).toBeUndefined();
        expect(await shareBoard(pass, 'new-token', true)).toEqual([]);
    });

    it('returns the same invite token when sharing again without a reset', async () => {
        const { owner, board } = await fixture();
        auth.userId = owner.id;
        const data = { boardId: board.id, reset: false };

        const first = await shareBoardServer({ data });
        // Telemetry redaction relies on the 64-character hex format.
        expect(first.token).toMatch(/^[a-f0-9]{64}$/);
        expect((await shareBoardServer({ data })).token).toBe(first.token);
    });

    it('the owner can revoke an editor’s read access', async () => {
        const { owner, editor, board } = await fixture();
        auth.userId = owner.id;

        await removeMemberServer({
            data: { boardId: board.id, memberId: editor.id },
        });

        await expect(
            authorizeBoard(editor.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('the owner cannot remove themselves', async () => {
        const { owner, board } = await fixture();
        auth.userId = owner.id;

        await expect(
            removeMemberServer({
                data: { boardId: board.id, memberId: owner.id },
            }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('rejects editors and strangers for all management handlers', async () => {
        const { editor, stranger, board } = await fixture();
        for (const person of [editor, stranger]) {
            auth.userId = person.id;
            await expect(
                getSharingServer({ data: { boardId: board.id } }),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
            await expect(
                shareBoardServer({ data: { boardId: board.id, reset: false } }),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
            await expect(
                removeMemberServer({
                    data: { boardId: board.id, memberId: editor.id },
                }),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
        }
    });
});
