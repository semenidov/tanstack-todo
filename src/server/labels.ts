import {
    authorizeBoard,
    authorizeCard,
    authorizeLabel,
    requireAffected,
} from '#/server/authorize';
import { Action } from '#/lib/permissions';
import { requireUser } from '#/lib/auth-server';
import { LabelColor } from '#/lib/label-colors';
import { MAX_LABEL_TITLE_LENGTH, normalizeLabelTitle } from '#/lib/labels';
import * as writes from '#/server/board-writes';
import * as repo from '#/server/labels-repo';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

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
        return repo.listLabels(
            await authorizeBoard({ id: userId }, boardId, Action.BoardRead),
        );
    });

export const createLabelServer = createServerFn({ method: 'POST' })
    .validator(labelInputSchema.extend({ boardId: z.uuid() }))
    .handler(async ({ data: { boardId, ...input } }) => {
        const label = await writes.createLabelAs(
            await requireUser(),
            boardId,
            input,
        );

        return label;
    });

export const updateLabelServer = createServerFn({ method: 'POST' })
    .validator(labelInputSchema.extend({ labelId: z.uuid() }))
    .handler(async ({ data: { labelId, ...input } }) => {
        const { id: userId } = await requireUser();
        const label = requireAffected(
            await repo.updateLabel(
                await authorizeLabel(
                    { id: userId },
                    labelId,
                    Action.ContentEdit,
                ),
                labelId,
                input,
            ),
        );

        return label;
    });

export const deleteLabelServer = createServerFn({ method: 'POST' })
    .validator(z.object({ labelId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        requireAffected(
            await repo.deleteLabel(
                await authorizeLabel(
                    { id: userId },
                    data.labelId,
                    Action.ContentEdit,
                ),
                data.labelId,
            ),
        );
    });

export const setCardLabelServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            cardId: z.uuid(),
            labelId: z.uuid(),
            on: z.boolean(),
        }),
    )
    .handler(async ({ data }) => {
        const user = await requireUser();
        if (!data.on) {
            requireAffected(
                await repo.removeCardLabel(
                    await authorizeCard(user, data.cardId, Action.ContentEdit),
                    data.cardId,
                    data.labelId,
                ),
            );
            return;
        }
        const added = await writes.addCardLabelAs(
            user,
            data.cardId,
            data.labelId,
        );
        if (!added) throw new Error('Label was not added');
    });
