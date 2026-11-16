import { describe, expect, it, vi } from 'vitest';
import { seedBoardMember, seedUser } from '#/test/db';
import { BOARD_ACCESS_DENIED } from '#/lib/permissions';
import { createBoard } from './boards-repo';
import {
    getSharingServer,
    shareBoardServer,
    removeMemberServer,
} from './members';

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

async function fixture() {
    const owner = await seedUser();
    const editor = await seedUser();
    const board = await createBoard(owner.id, 'Shared');
    await seedBoardMember(board.id, editor.id);
    return { owner, editor, board };
}

describe('owner sharing management', () => {
    it('returns the same invite token when sharing again without a reset', async () => {
        const { owner, board } = await fixture();
        auth.userId = owner.id;
        const data = { boardId: board.id, reset: false };

        const first = await shareBoardServer({ data });
        // Telemetry redaction relies on the 64-character hex format.
        expect(first.token).toMatch(/^[a-f0-9]{64}$/);
        expect((await shareBoardServer({ data })).token).toBe(first.token);
    });

    it('denies an editor access to sharing settings', async () => {
        const { editor, board } = await fixture();
        auth.userId = editor.id;

        await expect(
            getSharingServer({ data: { boardId: board.id } }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('denies an editor an invite link reset', async () => {
        const { editor, board } = await fixture();
        auth.userId = editor.id;

        await expect(
            shareBoardServer({ data: { boardId: board.id, reset: true } }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('denies an editor removal of another member', async () => {
        const { editor, board } = await fixture();
        const otherMember = await seedUser();
        await seedBoardMember(board.id, otherMember.id);
        auth.userId = editor.id;

        await expect(
            removeMemberServer({
                data: { boardId: board.id, memberId: otherMember.id },
            }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });
});
