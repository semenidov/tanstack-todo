import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const cardMutationKey = (cardId: string) => ['card', cardId] as const;

export const cardMutationOptions = (cardId: string) => ({
    mutationKey: cardMutationKey(cardId),
    scope: { id: `card-${cardId}` },
});

// Refetch only after the last queued request, or the card flickers back.
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
