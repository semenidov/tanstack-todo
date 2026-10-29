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
    toBoardTitle: string;
}

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

    const moveList = (listId: string, index: number): boolean => {
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
