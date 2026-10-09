import { requireUser } from '#/lib/auth-server';
import { LabelColor } from '#/lib/label-colors';
import { MAX_LABEL_TITLE_LENGTH, normalizeLabelTitle } from '#/lib/labels';
import * as writes from '#/server/board-writes';
import * as repo from '#/server/labels-repo';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

// Server fns of board labels (#120). A label without a title is stored as null.
const labelInputSchema = z.object({
    title: z
        .string()
        .trim()
        .max(MAX_LABEL_TITLE_LENGTH)
        .transform(normalizeLabelTitle),
    color: z.enum(LabelColor),
});

export const getLabelsServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: boardId }) => {
        const { id: userId } = await requireUser();
        return repo.listLabels(userId, boardId);
    });

export const createLabelServer = createServerFn({ method: 'POST' })
    .validator(labelInputSchema.extend({ boardId: z.uuid() }))
    .handler(async ({ data: { boardId, ...input } }) => {
        const label = await writes.createLabelAs(
            await requireUser(),
            boardId,
            input,
        );
        if (!label) throw new Error('Label was not created');
        return label;
    });

export const updateLabelServer = createServerFn({ method: 'POST' })
    .validator(labelInputSchema.extend({ labelId: z.uuid() }))
    .handler(async ({ data: { labelId, ...input } }) => {
        const { id: userId } = await requireUser();
        const label = await repo.updateLabel(userId, labelId, input);
        if (!label) throw new Error('Label was not saved');
        return label;
    });

export const deleteLabelServer = createServerFn({ method: 'POST' })
    .validator(z.object({ labelId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.deleteLabel(userId, data.labelId);
    });

export const setCardLabelServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            cardId: z.uuid(),
            labelId: z.uuid(),
            /** true - put the label on the card, false - take it off. */
            on: z.boolean(),
        }),
    )
    .handler(async ({ data }) => {
        const user = await requireUser();
        if (!data.on) {
            // Taking off a label that is not there is a no-op, not an error.
            await repo.removeCardLabel(user.id, data.cardId, data.labelId);
            return;
        }
        // A refusal (another board's label, a deleted card) reaches the client
        // as an error: it shows a toast and refetches the board.
        const added = await writes.addCardLabelAs(
            user,
            data.cardId,
            data.labelId,
        );
        if (!added) throw new Error('Label was not added');
    });
