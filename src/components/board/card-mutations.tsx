import {
    addCardToList,
    moveCardInBoard,
    removeCardFromBoard,
    restoreCardToBoard,
    updateCardInBoard,
} from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import type { Card } from '#/lib/boards-query';
import {
    addCardServer,
    deleteCardServer,
    moveCardServer,
    restoreCardServer,
    updateCardServer,
} from '#/server/boards';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

const UNDO_WINDOW_MS = 5000;

export function useAddCard(boardId: string, listId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    // Not optimistic: the card enters the cache only with the id the server gave it.
    return useMutation({
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
        },
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

export function useMoveCard(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    return useMutation({
        mutationFn: (vars: { cardId: string; toListId: string }) =>
            moveCardServer({ data: vars }),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old) =>
                old ? moveCardInBoard(old, vars.cardId, vars.toListId) : old,
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            toast.error("Couldn't move the card. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
        },
    });
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
