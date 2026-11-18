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
import { useMoveCard } from '#/components/board/card-mutations';
import {
    useIsListSyncing,
    useMoveList,
} from '#/components/board/list-mutations';
import { QuotaExceededError, QuotaKind } from '#/lib/quotas';
import { boardQueryOptions, boardsListQueryOptions } from '#/lib/boards-query';
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

const { moveListSpy, moveCardSpy } = vi.hoisted(() => ({
    moveListSpy: vi.fn<(args: unknown) => Promise<void>>(),
    moveCardSpy: vi.fn<(args: unknown) => Promise<void>>(),
}));

vi.mock('#/server/boards', () => ({
    moveListServer: moveListSpy,
    moveCardServer: moveCardSpy,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

/** A quota error as the client gets it: only the message survives the wire. */
const quotaError = (kind: QuotaKind, limit: number) =>
    new Error(new QuotaExceededError(kind, limit).message);

const key = boardQueryOptions('board-1').queryKey;
const otherKey = boardQueryOptions('board-2').queryKey;

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

function makeList(
    id: string,
    cardIds: Array<string> = [],
    boardId = 'board-1',
): ListWithCards {
    return {
        id,
        boardId,
        position: 'a0',
        title: id,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: cardIds.map((cardId) => makeCard(cardId, id)),
    };
}

function makeBoard(id: string, lists: Array<ListWithCards>): BoardData {
    return {
        board: {
            id,
            ownerId: 'user-1',
            myRole: Role.Owner,
            ownerName: 'Owner',
            title: id === 'board-1' ? 'Board' : 'Other board',
            createdAt: new Date(0),
            updatedAt: new Date(0),
        },
        lists,
    };
}

const board = makeBoard('board-1', [
    makeList('a', ['c1']),
    makeList('b'),
    makeList('c', ['d1']),
]);
const other = makeBoard('board-2', [
    makeList('x', [], 'board-2'),
    makeList('y', [], 'board-2'),
]);

function deferred() {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

function setup() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(key, board);
    queryClient.setQueryData(otherKey, other);
    const readBoard = vi.fn(async () => board);
    const readOther = vi.fn(async () => other);
    const readBoards = vi.fn(async () => []);
    queryClient.setQueryData(boardsListQueryOptions.queryKey, []);
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
            useQuery({
                queryKey: otherKey,
                queryFn: readOther,
                staleTime: Infinity,
            });
            useQuery({
                queryKey: boardsListQueryOptions.queryKey,
                queryFn: readBoards,
                staleTime: Infinity,
            });
            return {
                ...useMoveList('board-1'),
                moveCard: useMoveCard('board-1').moveCard,
                aSyncing: useIsListSyncing('board-1', 'a'),
                bSyncing: useIsListSyncing('board-1', 'b'),
                cSyncing: useIsListSyncing('board-1', 'c'),
            };
        },
        { wrapper },
    );
    const ids = (k = key) =>
        queryClient.getQueryData(k)?.lists.map((l) => l.id);
    return { queryClient, readBoard, readOther, readBoards, result, ids };
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe('useMoveList within the board', () => {
    it('sends no request when the list stays in place', () => {
        const { result, ids } = setup();

        let moved = true;
        act(() => {
            moved = result.current.moveList('b', 1);
        });

        expect(moved).toBe(false);
        expect(moveListSpy).not.toHaveBeenCalled();
        expect(ids()).toEqual(['a', 'b', 'c']);
    });

    it('moves the list in the cache at once and sends its neighbors, without a toast', async () => {
        moveListSpy.mockResolvedValue();
        const { result, ids } = setup();

        act(() => {
            result.current.moveList('a', 2);
        });

        expect(ids()).toEqual(['b', 'c', 'a']);
        await waitFor(() =>
            expect(moveListSpy).toHaveBeenCalledWith({
                data: {
                    listId: 'a',
                    toBoardId: 'board-1',
                    prevListId: 'c',
                    nextListId: null,
                },
            }),
        );

        expect(toast.success).not.toHaveBeenCalled();
    });

    it('keeps a cross-board list move and a card move in one queue without an early refetch', async () => {
        const first = deferred();
        const second = deferred();
        moveListSpy.mockReturnValueOnce(first.promise);
        moveCardSpy.mockReturnValueOnce(second.promise);
        const { result, queryClient, readBoard, ids } = setup();
        const saved = makeBoard('board-1', [
            makeList('b', ['d1']),
            makeList('c'),
        ]);
        saved.board.title = 'Saved';
        readBoard.mockResolvedValue(saved);

        act(() => {
            result.current.moveListToBoard('a', other.board, 1);
            result.current.moveCard('d1', 'b', 0);
        });

        await waitFor(() => expect(moveListSpy).toHaveBeenCalledTimes(1));
        expect(moveCardSpy).not.toHaveBeenCalled();
        expect(ids()).toEqual(['b', 'c']);
        expect(
            queryClient.getQueryData(key)?.lists[0].cards.map((c) => c.id),
        ).toEqual(['d1']);

        await act(async () => first.resolve());
        await waitFor(() => expect(moveCardSpy).toHaveBeenCalledTimes(1));
        expect(readBoard).not.toHaveBeenCalled();
        expect(
            queryClient.getQueryData(key)?.lists[0].cards.map((c) => c.id),
        ).toEqual(['d1']);

        await act(async () => second.resolve());
        await waitFor(() =>
            expect(queryClient.getQueryData(key)).toEqual(saved),
        );
    });

    it('shows a toast and refetches the board when the server refuses', async () => {
        moveListSpy.mockRejectedValue(new Error('List was not moved'));
        const { result, ids } = setup();

        act(() => {
            result.current.moveList('a', 2);
        });

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await waitFor(() => expect(ids()).toEqual(['a', 'b', 'c']));
    });
});

describe('useMoveList to another board', () => {
    it('takes the list off this board, sends the target neighbors, then toasts and refreshes both boards', async () => {
        moveListSpy.mockResolvedValue();
        const { result, ids, readBoard, readOther, readBoards, queryClient } =
            setup();
        readBoard.mockResolvedValue(makeBoard('board-1', board.lists.slice(1)));
        const moved = { ...board.lists[0], boardId: 'board-2' };
        const savedOther = makeBoard('board-2', [
            other.lists[0],
            moved,
            other.lists[1],
        ]);
        readOther.mockResolvedValue(savedOther);

        act(() => {
            result.current.moveListToBoard('a', other.board, 1);
        });

        expect(ids()).toEqual(['b', 'c']);
        await waitFor(() =>
            expect(moveListSpy).toHaveBeenCalledWith({
                data: {
                    listId: 'a',
                    toBoardId: 'board-2',
                    prevListId: 'x',
                    nextListId: 'y',
                },
            }),
        );
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        await waitFor(() =>
            expect(queryClient.getQueryData(otherKey)).toEqual(savedOther),
        );
        await waitFor(() => expect(ids()).toEqual(['b', 'c']));
        expect(readBoards).toHaveBeenCalled();
    });

    it('says the target board is full when the server refuses by quota', async () => {
        moveListSpy.mockRejectedValue(quotaError(QuotaKind.Lists, 30));
        const { result, ids } = setup();

        act(() => {
            result.current.moveListToBoard('a', other.board, 0);
        });

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                expect.stringMatching(/30 lists/),
            ),
        );
        await waitFor(() => expect(ids()).toEqual(['a', 'b', 'c']));
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('sends nothing while the target board is not loaded', () => {
        const { result, ids } = setup();

        let moved = true;
        act(() => {
            moved = result.current.moveListToBoard(
                'a',
                { id: 'board-3', title: 'Not loaded' },
                0,
            );
        });

        expect(moved).toBe(false);
        expect(moveListSpy).not.toHaveBeenCalled();
        expect(ids()).toEqual(['a', 'b', 'c']);
    });
});

describe('useIsListSyncing', () => {
    it('is true while the list move is in the queue', async () => {
        const move = deferred();
        moveListSpy.mockReturnValueOnce(move.promise);
        const { result } = setup();

        act(() => {
            result.current.moveList('a', 1);
        });

        await waitFor(() => expect(result.current.aSyncing).toBe(true));
        expect(result.current.bSyncing).toBe(false);
        await act(async () => move.resolve());
        await waitFor(() => expect(result.current.aSyncing).toBe(false));
    });

    it('is true for both lists while a card moves from one to the other', async () => {
        const move = deferred();
        moveCardSpy.mockReturnValueOnce(move.promise);
        const { result } = setup();

        act(() => {
            result.current.moveCard('c1', 'c', 0);
        });

        await waitFor(() => expect(result.current.aSyncing).toBe(true));
        expect(result.current.cSyncing).toBe(true);
        expect(result.current.bSyncing).toBe(false);
        await act(async () => move.resolve());
        await waitFor(() => expect(result.current.aSyncing).toBe(false));
    });
});
