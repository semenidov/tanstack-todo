// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_QUOTAS } from '#/lib/quotas';
import { moveCardOrThrow } from '#/server/move-card';

const { moveCardRepo } = vi.hoisted(() => ({
    moveCardRepo: vi.fn<(...args: Array<unknown>) => Promise<unknown>>(),
}));

vi.mock('#/server/authorize', () => ({
    authorizeCard: vi.fn(async (user) => ({
        userId: user.id,
        boardId: 'source',
    })),
    authorizeList: vi.fn(async (user) => ({
        userId: user.id,
        boardId: 'source',
    })),
    authorizeBoard: vi.fn(async (user, boardId) => ({
        userId: user.id,
        boardId,
    })),
    requireAffected: (row: unknown) => {
        if (!row) throw new Error("Board not found or you don't have access");
        return row;
    },
}));

vi.mock('#/lib/auth-server', () => ({ requireUser: vi.fn() }));

vi.mock('#/server/boards-repo', () => ({
    moveCard: moveCardRepo,
}));

const user = { id: 'user-1', isAnonymous: false };

const data = {
    cardId: '00000000-0000-4000-8000-000000000001',
    toListId: '00000000-0000-4000-8000-000000000002',
    prevCardId: null,
    nextCardId: '00000000-0000-4000-8000-000000000003',
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('moveCardOrThrow (moveCardServer)', () => {
    it('throws when the repo refuses the move', async () => {
        moveCardRepo.mockResolvedValue(null);

        await expect(moveCardOrThrow(user, data)).rejects.toThrow(
            "Board not found or you don't have access",
        );
        expect(moveCardRepo).toHaveBeenCalledWith(
            { userId: 'user-1', boardId: 'source' },
            data.cardId,
            data.toListId,
            null,
            data.nextCardId,
            USER_QUOTAS,
        );
    });

    it('resolves when the repo moved the card', async () => {
        moveCardRepo.mockResolvedValue({ id: data.cardId });

        await expect(moveCardOrThrow(user, data)).resolves.toBeUndefined();
    });
});
