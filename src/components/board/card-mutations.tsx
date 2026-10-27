import {
    boardOrderMutationKey,
    boardOrderMutationOptions,
    invalidateAfterLastBoardOrder,
} from '#/components/board/board-order';
import {
    cardMutationOptions,
    invalidateAfterLastCardMutation,
} from '#/components/board/card-queue';
import {
    addCardToList,
    cardIndexAfterNeighbors,
    cardMoveNeighbors,
    findCardInBoard,
    isSameCardSpot,
    moveCardInBoard,
    removeCardFromBoard,
    restoreCardToBoard,
    updateCardInBoard,
} from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import type { Card } from '#/lib/boards-query';
import type { CardMoveNeighbors } from '#/lib/boards';
import type { Due } from '#/lib/due-date';
import {
    createErrorMessage,
    moveErrorMessage,
    restoreErrorMessage,
} from '#/lib/quotas';
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
import { useServerFn } from '@tanstack/react-start';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

const UNDO_WINDOW_MS = 5000;

export function useAddCard(boardId: string, listId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    return useMutation({
        ...boardOrderMutationOptions(boardId),
        mutationFn: async (title: string) => {
            const card = await addCardServer({ data: { listId, title } });
            if (!card) throw new Error('Card was not created');
            return card;
        },
        onSuccess: async (card) => {
            await queryClient.cancelQueries({ queryKey: key });
            queryClient.setQueryData(key, (old) =>
                old
                    ? addCardToList(old, listId, {
                          ...card,
                          labelIds: [],
                          checklistDone: 0,
                          checklistTotal: 0,
                      })
                    : old,
            );
        },
        onError: (error) => {
            toast.error(
                createErrorMessage(
                    error,
                    "Couldn't add the card. Please try again.",
                ),
            );
        },
        onSettled: () => invalidateAfterLastBoardOrder(queryClient, boardId),
    });
}

export interface UpdateCardVars {
    title?: string;
    description?: string | null;
    completed?: boolean;
    due?: Due;
}

export function useUpdateCard(boardId: string, cardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    return useMutation({
        ...cardMutationOptions(cardId),
        mutationFn: ({ due, ...vars }: UpdateCardVars) =>
            updateCardServer({
                data: {
                    cardId,
                    ...vars,
                    ...(due && {
                        due: {
                            dueDate: due.dueDate,
                            dueAt: due.dueAt?.toISOString() ?? null,
                        },
                    }),
                },
            }),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: key });
            queryClient.setQueryData(key, (old) =>
                old
                    ? updateCardInBoard(old, cardId, {
                          ...(vars.title !== undefined && {
                              title: vars.title,
                          }),
                          ...(vars.description !== undefined && {
                              description: vars.description,
                          }),
                          ...(vars.completed !== undefined && {
                              completedAt: vars.completed ? new Date() : null,
                          }),
                          ...(vars.due && {
                              dueDate: vars.due.dueDate,
                              dueAt: vars.due.dueAt,
                          }),
                      })
                    : old,
            );
        },
        // No rollback: later queued edits sit on top of the snapshot. Refetch instead.
        onError: () => {
            toast.error("Couldn't save the card. Please try again.");
            void queryClient.invalidateQueries({ queryKey: key });
        },
        onSettled: () =>
            invalidateAfterLastCardMutation(queryClient, cardId, [key]),
    });
}

export interface MoveCardVars {
    cardId: string;
    fromListId: string;
    toListId: string;
    prevCardId: string | null;
    nextCardId: string | null;
}

export function useMoveCard(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    const { mutate } = useMutation({
        ...boardOrderMutationOptions(boardId),
        mutationFn: async ({
            cardId,
            toListId,
            prevCardId,
            nextCardId,
        }: MoveCardVars) => {
            await moveCardServer({
                data: { cardId, toListId, prevCardId, nextCardId },
            });
        },
        onError: (error) => {
            toast.error(
                moveErrorMessage(
                    error,
                    "Couldn't move the card. Please try again.",
                ),
            );
            void queryClient.invalidateQueries({ queryKey: key });
        },
        onSettled: () => invalidateAfterLastBoardOrder(queryClient, boardId),
    });

    const moveCard = (
        cardId: string,
        toListId: string,
        index: number,
    ): boolean => {
        // Synchronous: a refetch in flight must not overwrite the move.
        void queryClient.cancelQueries({ queryKey: key });
        const board = queryClient.getQueryData(key);
        if (!board || isSameCardSpot(board, cardId, toListId, index)) {
            return false;
        }
        const neighbors = cardMoveNeighbors(board, cardId, toListId, index);
        const from = findCardInBoard(board, cardId);
        if (!neighbors || !from) return false;

        queryClient.setQueryData(
            key,
            moveCardInBoard(board, cardId, toListId, index),
        );
        mutate({ cardId, fromListId: from.list.id, toListId, ...neighbors });
        return true;
    };

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

export function useIsCardSyncing(boardId: string, cardId: string) {
    const pending = useMutationState({
        filters: {
            mutationKey: boardOrderMutationKey(boardId),
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
        } catch (error) {
            removeFromCache(card.id);
            toast.error(
                restoreErrorMessage(
                    error,
                    "Couldn't restore the card. Please try again.",
                ),
            );
        } finally {
            invalidate();
        }
    };

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
