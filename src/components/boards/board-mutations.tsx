import { removeBoardFromList, renameBoardInList } from '#/lib/boards';
import { boardsListQueryOptions } from '#/lib/boards-query';
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
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old) =>
                old ? renameBoardInList(old, vars.boardId, vars.title) : old,
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            toast.error("Couldn't rename the board. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
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
