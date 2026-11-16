import type * as Authorization from '#/server/authorize';
import { BOARD_ACCESS_DENIED } from '#/lib/permissions';
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_QUOTAS } from '#/lib/quotas';
import { moveCardOrThrow } from '#/server/move-card';

vi.mock('#/db', () => ({ db: {} }));

const { moveCardRepo } = vi.hoisted(() => ({
    moveCardRepo: vi.fn<(...args: Array<unknown>) => Promise<unknown>>(),
}));

vi.mock('#/server/authorize', async (importOriginal) => {
    const actual = await importOriginal<typeof Authorization>();
    return {
        ...actual,
        authorizeCard: vi.fn(async (userId: string) => ({
            userId,
            boardId: 'source',
        })),
        authorizeList: vi.fn(async (userId: string) => ({
            userId,
            boardId: 'source',
        })),
        authorizeBoard: vi.fn(async (userId: string, boardId: string) => ({
            userId,
            boardId,
        })),
    };
});

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
            BOARD_ACCESS_DENIED,
        );
        expect(moveCardRepo).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-1' }),
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
