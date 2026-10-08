import { boardQueryOptions } from '#/lib/boards-query';
import type { QueryClient } from '@tanstack/react-query';

export const boardOrderMutationKey = (boardId: string) =>
    ['board-order', boardId] as const;

// Card creation and moves of one board run one after another: the server makes
// each key from the positions the previous requests already saved.
export const boardOrderMutationOptions = (boardId: string) => ({
    mutationKey: boardOrderMutationKey(boardId),
    scope: { id: `board-order-${boardId}` },
});

// Refetch only after the last queued request: an earlier refetch would bring back
// the server state without the moves still in the queue, and cards would jump.
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
