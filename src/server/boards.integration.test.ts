import { expect, it, vi } from 'vitest';
import { BOARD_ACCESS_DENIED } from '#/lib/permissions';
import { seedBoardMember, seedUser } from '#/test/db';
import { deleteBoardServer } from './boards';
import { createBoard, listBoards } from './boards-repo';

const auth = vi.hoisted(() => ({ userId: '' }));
vi.mock('#/lib/auth-server', () => ({
    requireUser: async () => ({ id: auth.userId }),
}));

vi.mock('@tanstack/react-start', () => ({
    createServerFn: () => ({
        validator: () => ({
            handler: (fn: (args: { data: unknown }) => unknown) => fn,
        }),
        handler: (fn: () => unknown) => fn,
    }),
}));

it('denies an editor a direct delete request', async () => {
    const owner = await seedUser();
    const editor = await seedUser();
    const board = await createBoard(owner.id, 'Shared');
    await seedBoardMember(board.id, editor.id);
    auth.userId = editor.id;

    await expect(
        deleteBoardServer({ data: { boardId: board.id } }),
    ).rejects.toThrow(BOARD_ACCESS_DENIED);
    expect(await listBoards(owner.id)).toMatchObject([{ id: board.id }]);
});
