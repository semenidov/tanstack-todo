import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    cardMutationOptions,
    invalidateAfterLastCardMutation,
} from '#/components/board/card-queue';
import { setChecklistProgressInBoard } from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import {
    addItemToChecklist,
    checklistProgress,
    moveItemInChecklist,
    removeItemFromChecklist,
    updateItemInChecklist,
} from '#/lib/checklist';
import type { Checklist, ChecklistItemNeighbors } from '#/lib/checklist';
import { checklistQueryOptions } from '#/lib/checklist-query';
import { createErrorMessage } from '#/lib/quotas';
import {
    addChecklistItemServer,
    createChecklistServer,
    deleteChecklistItemServer,
    deleteChecklistServer,
    moveChecklistItemServer,
    renameChecklistServer,
    updateChecklistItemServer,
} from '#/server/checklists';

function useChecklistCache(boardId: string, cardId: string) {
    const queryClient = useQueryClient();
    const checklistKey = checklistQueryOptions(cardId).queryKey;
    const boardKey = boardQueryOptions(boardId).queryKey;

    return {
        queryClient,
        keys: [checklistKey, boardKey],
        async cancel() {
            await queryClient.cancelQueries({ queryKey: checklistKey });
            await queryClient.cancelQueries({ queryKey: boardKey });
        },
        set(update: (checklist: Checklist | null) => Checklist | null) {
            const next = update(queryClient.getQueryData(checklistKey) ?? null);
            queryClient.setQueryData(checklistKey, next);
            const progress = checklistProgress(next?.items ?? []);
            queryClient.setQueryData(boardKey, (old) =>
                old ? setChecklistProgressInBoard(old, cardId, progress) : old,
            );
        },
    };
}

function useOptimisticChecklistMutation<TVars>(
    boardId: string,
    cardId: string,
    options: {
        mutationFn: (vars: TVars) => Promise<unknown>;
        apply: (checklist: Checklist, vars: TVars) => Checklist | null;
        errorText: string;
    },
) {
    const cache = useChecklistCache(boardId, cardId);
    const { queryClient, keys } = cache;

    return useMutation({
        ...cardMutationOptions(cardId),
        mutationFn: options.mutationFn,
        onMutate: async (vars: TVars) => {
            await cache.cancel();
            cache.set((old) => (old ? options.apply(old, vars) : old));
        },
        onError: () => {
            toast.error(options.errorText);
            for (const queryKey of keys) {
                void queryClient.invalidateQueries({ queryKey });
            }
        },
        onSettled: () =>
            invalidateAfterLastCardMutation(queryClient, cardId, keys),
    });
}

export function useCreateChecklist(boardId: string, cardId: string) {
    const cache = useChecklistCache(boardId, cardId);

    return useMutation({
        ...cardMutationOptions(cardId),
        mutationFn: (title: string) =>
            createChecklistServer({ data: { cardId, title } }),
        onSuccess: async (checklist) => {
            await cache.cancel();
            cache.set(() => checklist);
        },
        onError: () => {
            toast.error("Couldn't add the checklist. Please try again.");
        },
        onSettled: () =>
            invalidateAfterLastCardMutation(
                cache.queryClient,
                cardId,
                cache.keys,
            ),
    });
}

export function useAddChecklistItem(
    boardId: string,
    cardId: string,
    checklistId: string,
) {
    const cache = useChecklistCache(boardId, cardId);

    return useMutation({
        ...cardMutationOptions(cardId),
        mutationFn: (title: string) =>
            addChecklistItemServer({ data: { checklistId, title } }),
        onSuccess: async (item) => {
            await cache.cancel();
            cache.set((old) => (old ? addItemToChecklist(old, item) : old));
        },
        onError: (error) => {
            toast.error(
                createErrorMessage(
                    error,
                    "Couldn't add the item. Please try again.",
                ),
            );
        },
        onSettled: () =>
            invalidateAfterLastCardMutation(
                cache.queryClient,
                cardId,
                cache.keys,
            ),
    });
}

export function useRenameChecklist(boardId: string, cardId: string) {
    return useOptimisticChecklistMutation(boardId, cardId, {
        mutationFn: ({ checklistId, title }: RenameChecklistVars) =>
            renameChecklistServer({ data: { checklistId, title } }),
        apply: (checklist, { title }) => ({ ...checklist, title }),
        errorText: "Couldn't rename the checklist. Please try again.",
    });
}

interface RenameChecklistVars {
    checklistId: string;
    title: string;
}

export function useDeleteChecklist(boardId: string, cardId: string) {
    return useOptimisticChecklistMutation(boardId, cardId, {
        mutationFn: (checklistId: string) =>
            deleteChecklistServer({ data: { checklistId } }),
        apply: () => null,
        errorText: "Couldn't delete the checklist. Please try again.",
    });
}

export interface UpdateChecklistItemVars {
    itemId: string;
    title?: string;
    done?: boolean;
}

export function useUpdateChecklistItem(boardId: string, cardId: string) {
    return useOptimisticChecklistMutation(boardId, cardId, {
        mutationFn: (vars: UpdateChecklistItemVars) =>
            updateChecklistItemServer({ data: vars }),
        apply: (checklist, { itemId, ...patch }) =>
            updateItemInChecklist(checklist, itemId, patch),
        errorText: "Couldn't save the item. Please try again.",
    });
}

export function useDeleteChecklistItem(boardId: string, cardId: string) {
    return useOptimisticChecklistMutation(boardId, cardId, {
        mutationFn: (itemId: string) =>
            deleteChecklistItemServer({ data: { itemId } }),
        apply: (checklist, itemId) =>
            removeItemFromChecklist(checklist, itemId),
        errorText: "Couldn't delete the item. Please try again.",
    });
}

export interface MoveChecklistItemVars extends ChecklistItemNeighbors {
    itemId: string;
    toIndex: number;
}

/**
 * Writes the cache synchronously in the drop handler: `onMutate` runs too late.
 * React still sees the cache a tick later, so ChecklistSection keeps the drop.
 */
export function useMoveChecklistItem(boardId: string, cardId: string) {
    const cache = useChecklistCache(boardId, cardId);
    const { queryClient, keys } = cache;

    const { mutate } = useMutation({
        ...cardMutationOptions(cardId),
        mutationFn: ({
            itemId,
            prevItemId,
            nextItemId,
        }: MoveChecklistItemVars) =>
            moveChecklistItemServer({
                data: { itemId, prevItemId, nextItemId },
            }),
        onError: () => {
            toast.error("Couldn't move the item. Please try again.");
            for (const queryKey of keys) {
                void queryClient.invalidateQueries({ queryKey });
            }
        },
        onSettled: () =>
            invalidateAfterLastCardMutation(queryClient, cardId, keys),
    });

    return (vars: MoveChecklistItemVars) => {
        for (const queryKey of keys) {
            void queryClient.cancelQueries({ queryKey });
        }
        cache.set((old) =>
            old ? moveItemInChecklist(old, vars.itemId, vars.toIndex) : old,
        );
        mutate(vars);
    };
}
