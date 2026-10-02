import {
    addCardToList,
    cardIndexAfterNeighbors,
    cardMoveNeighbors,
    isSameCardSpot,
    moveCardInBoard,
    removeCardFromBoard,
    restoreCardToBoard,
    updateCardInBoard,
} from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import type { Card } from '#/lib/boards-query';
import type { CardMoveNeighbors } from '#/lib/boards';
import {
    addCardServer,
    deleteCardServer,
    moveCardServer,
    restoreCardServer,
    updateCardServer,
} from '#/server/boards';
import {
    useMutation,
    useMutationState,
    useQueryClient,
} from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

const UNDO_WINDOW_MS = 5000;

const cardOrderMutationKey = (boardId: string) =>
    ['card-order', boardId] as const;

// Card creation and moves of one board run one after another: the server makes
// each key from the positions the previous requests already saved.
const cardOrderMutationOptions = (boardId: string) => ({
    mutationKey: cardOrderMutationKey(boardId),
    scope: { id: `card-order-${boardId}` },
});

// Refetch only after the last queued request: an earlier refetch would bring back
// the server state without the moves still in the queue, and cards would jump.
function invalidateAfterLastCardOrder(
    queryClient: QueryClient,
    boardId: string,
) {
    const isLast =
        queryClient.isMutating({
            mutationKey: cardOrderMutationKey(boardId),
        }) === 1;
    if (isLast) {
        void queryClient.invalidateQueries({
            queryKey: boardQueryOptions(boardId).queryKey,
        });
    }
}

export function useAddCard(boardId: string, listId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    // Not optimistic: the card enters the cache only with the id the server gave it.
    return useMutation({
        ...cardOrderMutationOptions(boardId),
        mutationFn: async (title: string) => {
            const card = await addCardServer({ data: { listId, title } });
            // null: the list is gone or belongs to someone else.
            if (!card) throw new Error('Card was not created');
            return card;
        },
        onSuccess: async (card) => {
            await queryClient.cancelQueries({ queryKey: key });
            queryClient.setQueryData(key, (old) =>
                old ? addCardToList(old, listId, card) : old,
            );
        },
        onError: () => {
            toast.error("Couldn't add the card. Please try again.");
        },
        onSettled: () => invalidateAfterLastCardOrder(queryClient, boardId),
    });
}

export function useUpdateCard(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    return useMutation({
        mutationFn: (vars: {
            cardId: string;
            title?: string;
            description?: string | null;
        }) => updateCardServer({ data: vars }),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old) =>
                old
                    ? updateCardInBoard(old, vars.cardId, {
                          ...(vars.title !== undefined && {
                              title: vars.title,
                          }),
                          ...(vars.description !== undefined && {
                              description: vars.description,
                          }),
                      })
                    : old,
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            toast.error("Couldn't save the card. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
        },
    });
}

export interface MoveCardVars {
    cardId: string;
    toListId: string;
    prevCardId: string | null;
    nextCardId: string | null;
}

export function useMoveCard(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    const { mutate } = useMutation({
        ...cardOrderMutationOptions(boardId),
        mutationFn: async (vars: MoveCardVars) => {
            await moveCardServer({ data: vars });
        },
        // No snapshot rollback: later moves in the queue were applied on top of it.
        // The server state is the truth, so refetch it.
        onError: () => {
            toast.error("Couldn't move the card. Please try again.");
            void queryClient.invalidateQueries({ queryKey: key });
        },
        onSettled: () => invalidateAfterLastCardOrder(queryClient, boardId),
    });

    /**
     * Puts the card at `index` of `toListId` (counted without the card) in the cache
     * right away and queues the request with the neighbors from the cache.
     * Returns false when there is nothing to move.
     */
    const moveCard = (
        cardId: string,
        toListId: string,
        index: number,
    ): boolean => {
        // Synchronous cancel: a refetch in flight must not overwrite the move.
        void queryClient.cancelQueries({ queryKey: key });
        const board = queryClient.getQueryData(key);
        if (!board || isSameCardSpot(board, cardId, toListId, index)) {
            return false;
        }
        const neighbors = cardMoveNeighbors(board, cardId, toListId, index);
        if (!neighbors) return false;

        queryClient.setQueryData(
            key,
            moveCardInBoard(board, cardId, toListId, index),
        );
        mutate({ cardId, toListId, ...neighbors });
        return true;
    };

    /**
     * Same as `moveCard`, but the spot is given by neighbors taken earlier (a drag
     * shows a snapshot of the lists): cards added to the cache since then don't
     * shift the card off the spot the user saw.
     */
    const moveCardNextTo = (
        cardId: string,
        toListId: string,
        neighbors: CardMoveNeighbors,
    ): boolean => {
        const board = queryClient.getQueryData(key);
        if (!board) return false;
        const index = cardIndexAfterNeighbors(
            board,
            cardId,
            toListId,
            neighbors,
        );
        return index !== undefined && moveCard(cardId, toListId, index);
    };

    return { moveCard, moveCardNextTo };
}

/** True while the card has a move in the queue that the server has not confirmed. */
export function useIsCardSyncing(boardId: string, cardId: string) {
    const pending = useMutationState({
        filters: {
            mutationKey: cardOrderMutationKey(boardId),
            status: 'pending',
            predicate: (mutation) => {
                const vars = mutation.state.variables;
                return (
                    typeof vars === 'object' &&
                    vars !== null &&
                    'cardId' in vars &&
                    vars.cardId === cardId
                );
            },
        },
        select: (mutation) => mutation.mutationId,
    });
    return pending.length > 0;
}

export function useDeleteCard(boardId: string) {
    const queryClient = useQueryClient();
    const deleteCard = useServerFn(deleteCardServer);
    const restoreCard = useServerFn(restoreCardServer);
    const key = boardQueryOptions(boardId).queryKey;

    const removeFromCache = (cardId: string) =>
        queryClient.setQueryData(key, (old) =>
            old ? removeCardFromBoard(old, cardId) : old,
        );
    const returnToCache = (card: Card) =>
        queryClient.setQueryData(key, (old) =>
            old ? restoreCardToBoard(old, card) : old,
        );
    const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

    const undo = async (card: Card) => {
        await queryClient.cancelQueries({ queryKey: key });
        returnToCache(card);
        try {
            await restoreCard({ data: { cardId: card.id } });
        } catch {
            removeFromCache(card.id);
            toast.error("Couldn't restore the card. Please try again.");
        } finally {
            invalidate();
        }
    };

    // Soft delete on the server right away, so a refetch at any moment matches the cache.
    // The Undo toast appears once the delete is saved, so restore never races it.
    const deleteWithUndo = async (card: Card) => {
        await queryClient.cancelQueries({ queryKey: key });
        removeFromCache(card.id);
        try {
            await deleteCard({ data: { cardId: card.id } });
        } catch {
            returnToCache(card);
            toast.error("Couldn't delete the card. Please try again.");
            return;
        } finally {
            invalidate();
        }

        toast.warning(`Deleted "${card.title}"`, {
            icon: <Trash2Icon className="size-4" />,
            action: { label: 'Undo', onClick: () => void undo(card) },
            duration: UNDO_WINDOW_MS,
        });
    };

    return { deleteWithUndo };
}
