import { boardQueryOptions } from '#/lib/boards-query';
import type { QueryClient } from '@tanstack/react-query';

export const boardOrderMutationKey = (boardId: string) =>
    ['board-order', boardId] as const;

export const boardOrderMutationOptions = (boardId: string) => ({
    mutationKey: boardOrderMutationKey(boardId),
    scope: { id: `board-order-${boardId}` },
});

// Refetch only after the last queued request, or cards jump back.
export function invalidateAfterLastBoardOrder(
    queryClient: QueryClient,
    boardId: string,
) {
    const isLast =
        queryClient.isMutating({
            mutationKey: boardOrderMutationKey(boardId),
        }) === 1;
    if (isLast) {
        void queryClient.invalidateQueries({
            queryKey: boardQueryOptions(boardId).queryKey,
        });
    }
}
