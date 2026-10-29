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
    title: string;
    color: LabelColor;
}

function labelErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message === LABEL_EXISTS_MESSAGE) {
        return LABEL_EXISTS_MESSAGE;
    }
    return createErrorMessage(error, fallback);
}

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
    on: boolean;
}

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
