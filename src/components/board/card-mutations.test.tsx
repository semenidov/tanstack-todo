import { Role } from '#/lib/permissions';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    useDeleteCard,
    useIsCardSyncing,
    useMoveCard,
    useUpdateCard,
} from '#/components/board/card-mutations';
import { useToggleCardLabel } from '#/components/board/labels/label-mutations';
import { QuotaExceededError, QuotaKind } from '#/lib/quotas';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

const {
    moveCardSpy,
    deleteCardSpy,
    restoreCardSpy,
    updateCardSpy,
    setCardLabelSpy,
} = vi.hoisted(() => ({
    updateCardSpy: vi.fn<(...args: unknown[]) => Promise<void>>(),
    setCardLabelSpy: vi.fn<(...args: unknown[]) => Promise<void>>(),
    moveCardSpy: vi.fn<(args: unknown) => Promise<void>>(),
    deleteCardSpy: vi.fn<(args: unknown) => Promise<void>>(),
    restoreCardSpy: vi.fn<(args: unknown) => Promise<void>>(),
}));

vi.mock('#/server/boards', () => ({
    moveCardServer: moveCardSpy,
    updateCardServer: updateCardSpy,
    deleteCardServer: deleteCardSpy,
    restoreCardServer: restoreCardSpy,
}));

vi.mock('#/server/labels', () => ({ setCardLabelServer: setCardLabelSpy }));

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
        completedAt: null,
        dueDate: null,
        dueAt: null,
        labelIds: [],
        checklistDone: 0,
        checklistTotal: 0,
        position: 'a0',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

function makeList(id: string, cardIds: Array<string>): ListWithCards {
    return {
        id,
        boardId: 'board-1',
        position: 'a0',
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
        myRole: Role.Owner,
        ownerName: 'Owner',
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
    const readBoard = vi.fn(async () => board);
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
    const { result } = renderHook(
        () => {
            useQuery({
                queryKey: key,
                queryFn: readBoard,
                staleTime: Infinity,
            });
            return {
                ...useMoveCard('board-1'),
                update: useUpdateCard('board-1', 'c1'),
                toggleLabel: useToggleCardLabel('board-1', 'c1'),
                c1Syncing: useIsCardSyncing('board-1', 'c1'),
            };
        },
        { wrapper },
    );
    const ids = () =>
        queryClient
            .getQueryData(key)
            ?.lists.map((l) => l.cards.map((c) => c.id));
    return { queryClient, readBoard, result, ids };
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe('useMoveCard', () => {
    it('sends no request when the card stays in place', () => {
        const { result, ids } = setup();

        act(() => result.current.moveCard('c2', 'a', 1));

        expect(moveCardSpy).not.toHaveBeenCalled();
        expect(ids()).toEqual([['c1', 'c2', 'c3'], ['d1']]);
    });

    it('moves the card in the cache at once and sends its neighbors', async () => {
        const pending = deferred();
        moveCardSpy.mockReturnValueOnce(pending.promise);
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
        await waitFor(() => expect(result.current.c1Syncing).toBe(true));
        await act(async () => pending.resolve());
        await waitFor(() => expect(result.current.c1Syncing).toBe(false));
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

    it('shows a toast and refetches the board when the server refuses', async () => {
        moveCardSpy.mockRejectedValue(new Error('Card was not moved'));
        const { result, ids } = setup();

        act(() => result.current.moveCard('c1', 'b', 0));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await waitFor(() =>
            expect(ids()).toEqual([['c1', 'c2', 'c3'], ['d1']]),
        );
    });

    it('says the target list is full when the server refuses by quota', async () => {
        moveCardSpy.mockRejectedValue(quotaError(QuotaKind.Cards, 200));
        const { result, ids } = setup();

        act(() => result.current.moveCard('c1', 'b', 0));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                expect.stringMatching(/200 cards/),
            ),
        );
        await waitFor(() =>
            expect(ids()).toEqual([['c1', 'c2', 'c3'], ['d1']]),
        );
    });
});

describe('useDeleteCard', () => {
    it('explains a reached quota when Undo is refused and keeps the card deleted', async () => {
        deleteCardSpy.mockResolvedValue(undefined);
        restoreCardSpy.mockRejectedValue(quotaError(QuotaKind.Cards, 200));
        const { queryClient, readBoard } = setup();
        readBoard.mockResolvedValue({
            ...board,
            lists: [makeList('a', ['c2', 'c3']), board.lists[1]],
        });
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
                expect.stringMatching(/limit.*200 cards/),
            ),
        );
        expect(
            queryClient.getQueryData(key)?.lists[0].cards.map((c) => c.id),
        ).not.toContain(card.id);
    });
});

describe('card content queue', () => {
    it('keeps different edits optimistic and saves them in order before reconciling', async () => {
        const first = deferred();
        const second = deferred();
        updateCardSpy.mockReturnValueOnce(first.promise);
        setCardLabelSpy.mockReturnValueOnce(second.promise);
        const { result, queryClient, readBoard } = setup();
        const card = () => queryClient.getQueryData(key)?.lists[0].cards[0];
        const saved = structuredClone(board);
        saved.lists[0].cards[0].title = 'Saved title';
        saved.lists[0].cards[0].labelIds = ['label-1'];
        saved.lists[0].cards[0].updatedAt = new Date(1000);
        readBoard.mockResolvedValue(saved);

        act(() => {
            result.current.update.mutate({ title: 'Saved title' });
            result.current.toggleLabel.mutate({ labelId: 'label-1', on: true });
        });

        await waitFor(() =>
            expect(card()).toMatchObject({
                title: 'Saved title',
                labelIds: ['label-1'],
            }),
        );
        expect(updateCardSpy).toHaveBeenCalledTimes(1);
        expect(setCardLabelSpy).not.toHaveBeenCalled();

        await act(async () => first.resolve());
        await waitFor(() =>
            expect(setCardLabelSpy).toHaveBeenCalledWith({
                data: { cardId: 'c1', labelId: 'label-1', on: true },
            }),
        );
        expect(readBoard).not.toHaveBeenCalled();
        expect(card()).toMatchObject({
            title: 'Saved title',
            labelIds: ['label-1'],
        });

        await act(async () => second.resolve());
        await waitFor(() => expect(card()).toEqual(saved.lists[0].cards[0]));
    });

    it.fails(
        'known bug: a failed title update must not hide the pending label change',
        async () => {
            const first = deferred();
            const second = deferred();
            updateCardSpy.mockReturnValueOnce(first.promise);
            setCardLabelSpy.mockReturnValueOnce(second.promise);
            const { result, queryClient, readBoard } = setup();
            const card = () => queryClient.getQueryData(key)?.lists[0].cards[0];

            act(() => {
                result.current.update.mutate({ title: 'Rejected title' });
                result.current.toggleLabel.mutate({
                    labelId: 'label-1',
                    on: true,
                });
            });
            await waitFor(() => expect(card()?.labelIds).toEqual(['label-1']));

            await act(async () => first.reject(new Error('Save failed')));
            await waitFor(() =>
                expect(setCardLabelSpy).toHaveBeenCalledTimes(1),
            );
            expect(toast.error).toHaveBeenCalled();
            const pendingLabels = card()?.labelIds;
            const saved = structuredClone(board);
            saved.lists[0].cards[0].labelIds = ['label-1'];
            readBoard.mockResolvedValue(saved);
            await act(async () => second.resolve());
            await waitFor(() =>
                expect(card()).toEqual(saved.lists[0].cards[0]),
            );

            expect(pendingLabels).toEqual(['label-1']);
        },
    );
});
