// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_QUOTAS, USER_QUOTAS } from '#/lib/quotas';
import { moveListOrThrow } from '#/server/move-list';

const { moveListRepo } = vi.hoisted(() => ({
    moveListRepo: vi.fn<(...args: Array<unknown>) => Promise<unknown>>(),
}));

vi.mock('#/lib/auth-server', () => ({ requireUser: vi.fn() }));

vi.mock('#/server/boards-repo', () => ({
    moveList: moveListRepo,
}));

const user = { id: 'user-1', isAnonymous: false };

const data = {
    listId: '00000000-0000-4000-8000-000000000001',
    toBoardId: '00000000-0000-4000-8000-000000000002',
    prevListId: null,
    nextListId: '00000000-0000-4000-8000-000000000003',
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('moveListOrThrow (moveListServer)', () => {
    it('throws when the repo refuses the move', async () => {
        moveListRepo.mockResolvedValue(null);

        await expect(moveListOrThrow(user, data)).rejects.toThrow(
            'List was not moved',
        );
        expect(moveListRepo).toHaveBeenCalledWith(
            'user-1',
            data.listId,
            data.toBoardId,
            null,
            data.nextListId,
            USER_QUOTAS,
        );
    });

    it('resolves when the repo moved the list', async () => {
        moveListRepo.mockResolvedValue({ id: data.listId });

        await expect(moveListOrThrow(user, data)).resolves.toBeUndefined();
    });

    it('passes the guest quotas for a guest', async () => {
        moveListRepo.mockResolvedValue({ id: data.listId });

        await moveListOrThrow({ id: 'guest-1', isAnonymous: true }, data);
        expect(moveListRepo).toHaveBeenCalledWith(
            'guest-1',
            data.listId,
            data.toBoardId,
            null,
            data.nextListId,
            GUEST_QUOTAS,
        );
    });
});
