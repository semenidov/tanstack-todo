import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const cardMutationKey = (cardId: string) => ['card', cardId] as const;

// Mutations of one card's content (completion, due date, labels, checklist) run
// one after another, like board-order.ts (ADR 60): fast clicks reach the server
// in the order they were made.
export const cardMutationOptions = (cardId: string) => ({
    mutationKey: cardMutationKey(cardId),
    scope: { id: `card-${cardId}` },
});

// Refetch only after the last queued request: an earlier refetch would bring back
// the server state without the changes still in the queue, and the card would
// flicker back. `queryKeys` - the caches the mutation touched (board, checklist).
export function invalidateAfterLastCardMutation(
    queryClient: QueryClient,
    cardId: string,
    queryKeys: QueryKey[],
) {
    const isLast =
        queryClient.isMutating({ mutationKey: cardMutationKey(cardId) }) === 1;
    if (!isLast) return;
    for (const queryKey of queryKeys) {
        void queryClient.invalidateQueries({ queryKey });
    }
}
