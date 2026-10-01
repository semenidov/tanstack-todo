import { removeBoardFromList, renameBoardInList } from '#/lib/boards';
import { boardQueryOptions, boardsListQueryOptions } from '#/lib/boards-query';
import { deleteBoardServer, renameBoardServer } from '#/server/boards';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const key = boardsListQueryOptions.queryKey;

export function useRenameBoard() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (vars: { boardId: string; title: string }) =>
            renameBoardServer({ data: vars }),
        onMutate: async (vars) => {
            const boardKey = boardQueryOptions(vars.boardId).queryKey;
            await Promise.all([
                queryClient.cancelQueries({ queryKey: key }),
                queryClient.cancelQueries({ queryKey: boardKey }),
            ]);
            const previous = queryClient.getQueryData(key);
            const previousBoard = queryClient.getQueryData(boardKey);
            queryClient.setQueryData(key, (old) =>
                old ? renameBoardInList(old, vars.boardId, vars.title) : old,
            );
            // The board page header reads the board cache (absent if it was never opened).
            queryClient.setQueryData(boardKey, (old) =>
                old
                    ? { ...old, board: { ...old.board, title: vars.title } }
                    : old,
            );
            return { previous, previousBoard };
        },
        onError: (_error, vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            queryClient.setQueryData(
                boardQueryOptions(vars.boardId).queryKey,
                context?.previousBoard,
            );
            toast.error("Couldn't rename the board. Please try again.");
        },
        onSettled: (_data, _error, vars) => {
            queryClient.invalidateQueries({ queryKey: key });
            queryClient.invalidateQueries({
                queryKey: boardQueryOptions(vars.boardId).queryKey,
            });
        },
    });
}

export function useDeleteBoard() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (boardId: string) =>
            deleteBoardServer({ data: { boardId } }),
        onMutate: async (boardId) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old) =>
                old ? removeBoardFromList(old, boardId) : old,
            );
            return { previous };
        },
        onError: (_error, _boardId, context) => {
            queryClient.setQueryData(key, context?.previous);
            toast.error("Couldn't delete the board. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
        },
    });
}
