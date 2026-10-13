import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    cardMutationOptions,
    invalidateAfterLastCardMutation,
} from '#/components/board/card-queue';
import { removeLabelFromBoard, setCardLabelInBoard } from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import {
    LABEL_EXISTS_MESSAGE,
    addLabelToList,
    removeLabelFromList,
    replaceLabelInList,
} from '#/lib/labels';
import type { LabelColor } from '#/lib/label-colors';
import { labelsQueryOptions } from '#/lib/labels-query';
import { createErrorMessage } from '#/lib/quotas';
import {
    createLabelServer,
    deleteLabelServer,
    setCardLabelServer,
    updateLabelServer,
} from '#/server/labels';

export interface LabelFormValues {
    /** As typed; the server trims it and stores an empty one as null. */
    title: string;
    color: LabelColor;
}

/** Toast text for a failed create or edit: a duplicate title, a quota, or `fallback`. */
function labelErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message === LABEL_EXISTS_MESSAGE) {
        return LABEL_EXISTS_MESSAGE;
    }
    return createErrorMessage(error, fallback);
}

// Creating and editing a label wait for the server (ADR 56): the form stays
// with the typed text until the label is saved, and an error leaves it as is.

export function useCreateLabel(boardId: string) {
    const queryClient = useQueryClient();
    const key = labelsQueryOptions(boardId).queryKey;

    return useMutation({
        mutationFn: (values: LabelFormValues) =>
            createLabelServer({ data: { boardId, ...values } }),
        onSuccess: (label) => {
            queryClient.setQueryData(key, (old) =>
                addLabelToList(old ?? [], label),
            );
        },
        onError: (error) => {
            toast.error(
                labelErrorMessage(
                    error,
                    "Couldn't create the label. Please try again.",
                ),
            );
        },
    });
}

export function useUpdateLabel(boardId: string) {
    const queryClient = useQueryClient();
    const key = labelsQueryOptions(boardId).queryKey;

    return useMutation({
        mutationFn: ({
            labelId,
            ...values
        }: LabelFormValues & { labelId: string }) =>
            updateLabelServer({ data: { labelId, ...values } }),
        onSuccess: (label) => {
            queryClient.setQueryData(key, (old) =>
                old ? replaceLabelInList(old, label) : old,
            );
        },
        onError: (error) => {
            toast.error(
                labelErrorMessage(
                    error,
                    "Couldn't save the label. Please try again.",
                ),
            );
        },
    });
}

/** Deletes the label for good (no Undo) and takes it off the board's cards. */
export function useDeleteLabel(boardId: string) {
    const queryClient = useQueryClient();
    const labelsKey = labelsQueryOptions(boardId).queryKey;
    const boardKey = boardQueryOptions(boardId).queryKey;

    return useMutation({
        mutationFn: (labelId: string) =>
            deleteLabelServer({ data: { labelId } }),
        onSuccess: async (_data, labelId) => {
            queryClient.setQueryData(labelsKey, (old) =>
                old ? removeLabelFromList(old, labelId) : old,
            );
            await queryClient.cancelQueries({ queryKey: boardKey });
            queryClient.setQueryData(boardKey, (old) =>
                old ? removeLabelFromBoard(old, labelId) : old,
            );
        },
        onError: () => {
            toast.error("Couldn't delete the label. Please try again.");
        },
    });
}

export interface ToggleCardLabelVars {
    labelId: string;
    /** true - put on the card, false - take off. */
    on: boolean;
}

// A checkbox in the labels popover: optimistic (ADR 3), in the card's queue
// (card-queue.ts), so fast clicks reach the server in order.
export function useToggleCardLabel(boardId: string, cardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    return useMutation({
        ...cardMutationOptions(cardId),
        mutationFn: ({ labelId, on }: ToggleCardLabelVars) =>
            setCardLabelServer({ data: { cardId, labelId, on } }),
        onMutate: async ({ labelId, on }) => {
            await queryClient.cancelQueries({ queryKey: key });
            queryClient.setQueryData(key, (old) =>
                old ? setCardLabelInBoard(old, cardId, labelId, on) : old,
            );
        },
        // No snapshot rollback: later toggles in the queue were applied on top
        // of it. The server state is the truth, so refetch it.
        onError: (error) => {
            toast.error(
                createErrorMessage(
                    error,
                    "Couldn't save the card's labels. Please try again.",
                ),
            );
            void queryClient.invalidateQueries({ queryKey: key });
        },
        onSettled: () =>
            invalidateAfterLastCardMutation(queryClient, cardId, [key]),
    });
}
