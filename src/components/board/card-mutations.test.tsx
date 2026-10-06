import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    useDeleteCard,
    useIsCardSyncing,
    useMoveCard,
} from '#/components/board/card-mutations';
import { QuotaExceededError, QuotaKind } from '#/lib/quotas';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

const { moveCardSpy, deleteCardSpy, restoreCardSpy } = vi.hoisted(() => ({
    moveCardSpy: vi.fn<(args: unknown) => Promise<void>>(),
    deleteCardSpy: vi.fn<(args: unknown) => Promise<void>>(),
    restoreCardSpy: vi.fn<(args: unknown) => Promise<void>>(),
}));

vi.mock('#/server/boards', () => ({
    moveCardServer: moveCardSpy,
    deleteCardServer: deleteCardSpy,
    restoreCardServer: restoreCardSpy,
}));

/** A quota error as the client gets it: only the message survives the wire. */
const quotaError = (kind: QuotaKind, limit: number) =>
    new Error(new QuotaExceededError(kind, limit).message);

vi.mock('@tanstack/react-start', () => ({
    useServerFn: (fn: unknown) => fn,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const key = boardQueryOptions('board-1').queryKey;

function makeCard(id: string, listId: string): Card {
    return {
        id,
        listId,
        title: id,
        description: null,
        position: 'a0',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

function makeList(id: string, cardIds: Array<string>): ListWithCards {
    return {
        id,
        boardId: 'board-1',
        title: id,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: cardIds.map((cardId) => makeCard(cardId, id)),
    };
}

const board: BoardData = {
    board: {
        id: 'board-1',
        ownerId: 'user-1',
        title: 'Board',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    },
    lists: [makeList('a', ['c1', 'c2', 'c3']), makeList('b', ['d1'])],
};

function deferred() {
    let resolve: () => void = () => {};
    let reject: (error: Error) => void = () => {};
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function setup() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(key, board);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
    const { result } = renderHook(
        () => ({
            ...useMoveCard('board-1'),
            c1Syncing: useIsCardSyncing('board-1', 'c1'),
        }),
        { wrapper },
    );
    const ids = () =>
        queryClient
            .getQueryData(key)
            ?.lists.map((l) => l.cards.map((c) => c.id));
    return { queryClient, invalidate, result, ids };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useMoveCard', () => {
    it('sends no request when the card stays in place', () => {
        const { result, ids } = setup();

        act(() => result.current.moveCard('c2', 'a', 1));

        expect(moveCardSpy).not.toHaveBeenCalled();
        expect(ids()).toEqual([['c1', 'c2', 'c3'], ['d1']]);
    });

    it('moves the card in the cache at once and sends its neighbors', async () => {
        moveCardSpy.mockResolvedValue();
        const { result, ids } = setup();

        act(() => result.current.moveCard('c1', 'a', 2));

        expect(ids()).toEqual([['c2', 'c3', 'c1'], ['d1']]);
        await waitFor(() =>
            expect(moveCardSpy).toHaveBeenCalledWith({
                data: {
                    cardId: 'c1',
                    toListId: 'a',
                    prevCardId: 'c3',
                    nextCardId: null,
                },
            }),
        );
    });

    it('places a dropped card by the neighbors the drag showed, even if the cache changed', async () => {
        moveCardSpy.mockResolvedValue();
        const { queryClient, result, ids } = setup();
        // The drag showed [c1, c2, c3]; meanwhile a new card came on top.
        const changed: BoardData = {
            ...board,
            lists: [
                makeList('a', ['n0', 'c1', 'c2', 'c3']),
                makeList('b', ['d1']),
            ],
        };
        queryClient.setQueryData(key, changed);

        act(() => {
            result.current.moveCardNextTo('c3', 'a', {
                prevCardId: 'c1',
                nextCardId: 'c2',
            });
        });

        expect(ids()).toEqual([['n0', 'c1', 'c3', 'c2'], ['d1']]);
        await waitFor(() =>
            expect(moveCardSpy).toHaveBeenCalledWith({
                data: {
                    cardId: 'c3',
                    toListId: 'a',
                    prevCardId: 'c1',
                    nextCardId: 'c2',
                },
            }),
        );
    });

    it('queues quick moves and refetches the board only after the last one', async () => {
        const first = deferred();
        const second = deferred();
        moveCardSpy
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const { result, ids, invalidate } = setup();

        act(() => {
            result.current.moveCard('c1', 'b', 0);
            result.current.moveCard('c3', 'b', 2);
        });

        expect(ids()).toEqual([['c2'], ['c1', 'd1', 'c3']]);
        await waitFor(() => expect(moveCardSpy).toHaveBeenCalledTimes(1));
        expect(result.current.c1Syncing).toBe(true);

        await act(async () => first.resolve());
        await waitFor(() => expect(moveCardSpy).toHaveBeenCalledTimes(2));
        expect(moveCardSpy).toHaveBeenLastCalledWith({
            data: {
                cardId: 'c3',
                toListId: 'b',
                prevCardId: 'd1',
                nextCardId: null,
            },
        });
        expect(result.current.c1Syncing).toBe(false);
        expect(invalidate).not.toHaveBeenCalled();

        await act(async () => second.resolve());
        await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    });

    it('shows a toast and refetches the board when the server refuses', async () => {
        moveCardSpy.mockRejectedValue(new Error('Card was not moved'));
        const { result, invalidate } = setup();

        act(() => result.current.moveCard('c1', 'b', 0));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Couldn't move the card. Please try again.",
            ),
        );
        expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
    });

    it('says the target list is full when the server refuses by quota', async () => {
        moveCardSpy.mockRejectedValue(quotaError(QuotaKind.Cards, 200));
        const { result, invalidate } = setup();

        act(() => result.current.moveCard('c1', 'b', 0));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Can't move: this list already has 200 cards.",
            ),
        );
        expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
    });
});

describe('useDeleteCard', () => {
    it('explains a reached quota when Undo is refused and keeps the card deleted', async () => {
        deleteCardSpy.mockResolvedValue(undefined);
        restoreCardSpy.mockRejectedValue(quotaError(QuotaKind.Cards, 200));
        const { queryClient } = setup();
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
        const { result } = renderHook(() => useDeleteCard('board-1'), {
            wrapper,
        });
        const card = board.lists[0].cards[0];

        await act(() => result.current.deleteWithUndo(card));
        const undo = vi.mocked(toast.warning).mock.calls[0]?.[1]?.action;
        expect(undo).toBeDefined();
        act(() => {
            if (undo && typeof undo === 'object' && 'onClick' in undo)
                undo.onClick({} as never);
        });

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Can't restore: you've reached the limit of 200 cards in this list.",
            ),
        );
        expect(
            queryClient.getQueryData(key)?.lists[0].cards.map((c) => c.id),
        ).not.toContain(card.id);
    });
});
