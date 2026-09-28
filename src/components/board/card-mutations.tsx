import {
    addCardToList,
    moveCardInBoard,
    removeCardFromBoard,
    updateCardInBoard,
} from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import type { Card } from '#/lib/boards-query';
import {
    addCardServer,
    deleteCardServer,
    moveCardServer,
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

    return useMutation({
        mutationFn: (title: string) =>
            addCardServer({ data: { listId, title } }),
        onMutate: async (title) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            const card: Card = {
                id: crypto.randomUUID(),
                listId,
                title,
                description: null,
                legacyTodoId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            queryClient.setQueryData(key, (old) =>
                old ? addCardToList(old, listId, card) : old,
            );
            return { previous };
        },
        onError: (_error, _title, context) => {
            queryClient.setQueryData(key, context?.previous);
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
    const key = boardQueryOptions(boardId).queryKey;

    const deleteWithUndo = (card: Card) => {
        const previous = queryClient.getQueryData(key);
        queryClient.setQueryData(key, (old) =>
            old ? removeCardFromBoard(old, card.id) : old,
        );

        let settled = false;
        const restore = () => queryClient.setQueryData(key, previous);

        const commit = async () => {
            if (settled) return;
            settled = true;
            try {
                await deleteCard({ data: { cardId: card.id } });
                queryClient.invalidateQueries({ queryKey: key });
            } catch {
                restore();
                toast.error("Couldn't delete the card. Please try again.");
            }
        };

        const undo = () => {
            if (settled) return;
            settled = true;
            restore();
        };

        toast.warning(`Deleted "${card.title}"`, {
            icon: <Trash2Icon className="size-4" />,
            action: { label: 'Undo', onClick: undo },
            duration: UNDO_WINDOW_MS,
            onAutoClose: commit,
            onDismiss: commit,
        });
    };

    return { deleteWithUndo };
}
