import {
    boardOrderMutationKey,
    boardOrderMutationOptions,
    invalidateAfterLastBoardOrder,
} from '#/components/board/board-order';
import {
    isSameListSpot,
    listMoveNeighbors,
    moveListInBoard,
    removeListFromBoard,
} from '#/lib/boards';
import type { ListMoveNeighbors } from '#/lib/boards';
import { boardQueryOptions, boardsListQueryOptions } from '#/lib/boards-query';
import { moveErrorMessage } from '#/lib/quotas';
import { moveListServer } from '#/server/boards';
import {
    useMutation,
    useMutationState,
    useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

export interface MoveListVars extends ListMoveNeighbors {
    listId: string;
    toBoardId: string;
    /** For the toast after a move to another board; not sent. */
    toBoardTitle: string;
}

/**
 * List moves go through the board's order queue together with card moves: the
 * server makes each key from what the previous requests already saved.
 */
export function useMoveList(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    const { mutate } = useMutation({
        ...boardOrderMutationOptions(boardId),
        mutationFn: async ({
            listId,
            toBoardId,
            prevListId,
            nextListId,
        }: MoveListVars) => {
            await moveListServer({
                data: { listId, toBoardId, prevListId, nextListId },
            });
        },
        onSuccess: (_data, vars) => {
            if (vars.toBoardId === boardId) return;
            toast.success(`Moved to ${vars.toBoardTitle}`);
            void queryClient.invalidateQueries({
                queryKey: boardQueryOptions(vars.toBoardId).queryKey,
            });
            // Exact: the prefix would also refetch this board mid-queue.
            void queryClient.invalidateQueries({
                queryKey: boardsListQueryOptions.queryKey,
                exact: true,
            });
        },
        // No snapshot rollback (later moves were applied on top of it): the refetch
        // after the last queued request brings the server state back.
        onError: (error) => {
            toast.error(
                moveErrorMessage(
                    error,
                    "Couldn't move the list. Please try again.",
                ),
            );
        },
        onSettled: () => invalidateAfterLastBoardOrder(queryClient, boardId),
    });

    /**
     * Puts the list at `index` of this board (counted without the list) in the
     * cache right away and queues the request. False when there is nothing to move.
     */
    const moveList = (listId: string, index: number): boolean => {
        // Synchronous cancel: a refetch in flight must not overwrite the move.
        void queryClient.cancelQueries({ queryKey: key });
        const board = queryClient.getQueryData(key);
        if (!board || isSameListSpot(board, listId, index)) return false;

        queryClient.setQueryData(key, moveListInBoard(board, listId, index));
        mutate({
            listId,
            toBoardId: boardId,
            toBoardTitle: board.board.title,
            ...listMoveNeighbors(board, listId, index),
        });
        return true;
    };

    /**
     * Moves the list with its cards to `index` of another board. The neighbors come
     * from that board's cached data (the Move window loads it); the list leaves
     * this board's cache at once.
     */
    const moveListToBoard = (
        listId: string,
        toBoard: { id: string; title: string },
        index: number,
    ): boolean => {
        if (toBoard.id === boardId) return moveList(listId, index);
        const target = queryClient.getQueryData(
            boardQueryOptions(toBoard.id).queryKey,
        );
        if (!target) return false;

        void queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData(key, (old) =>
            old ? removeListFromBoard(old, listId) : old,
        );
        mutate({
            listId,
            toBoardId: toBoard.id,
            toBoardTitle: toBoard.title,
            ...listMoveNeighbors(target, listId, index),
        });
        return true;
    };

    return { moveList, moveListToBoard };
}

/**
 * True while the queue has a move of the list or of a card into or out of it:
 * deleting the list or moving it to another board would race those requests.
 */
export function useIsListSyncing(boardId: string, listId: string) {
    const pending = useMutationState({
        filters: {
            mutationKey: boardOrderMutationKey(boardId),
            status: 'pending',
            predicate: (mutation) => {
                const vars = mutation.state.variables;
                if (typeof vars !== 'object' || vars === null) return false;
                return (
                    ('listId' in vars && vars.listId === listId) ||
                    ('toListId' in vars && vars.toListId === listId) ||
                    ('fromListId' in vars && vars.fromListId === listId)
                );
            },
        },
        select: (mutation) => mutation.mutationId,
    });
    return pending.length > 0;
}
