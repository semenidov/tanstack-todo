import {
    authorizeCard,
    authorizeChecklist,
    authorizeChecklistItem,
    requireAffected,
} from '#/server/authorize';
import { Action } from '#/lib/permissions';
import { requireUser } from '#/lib/auth-server';
import { MAX_CHECKLIST_TEXT_LENGTH } from '#/lib/checklist';
import * as writes from '#/server/board-writes';
import * as repo from '#/server/checklists-repo';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

const textSchema = z.string().trim().min(1).max(MAX_CHECKLIST_TEXT_LENGTH);

export const getChecklistServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: cardId }) => {
        const { id: userId } = await requireUser();
        return repo.getChecklist(
            await authorizeCard({ id: userId }, cardId, Action.BoardRead),
            cardId,
        );
    });

export const createChecklistServer = createServerFn({ method: 'POST' })
    .validator(z.object({ cardId: z.uuid(), title: textSchema }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        const checklist = requireAffected(
            await repo.createChecklist(
                await authorizeCard(
                    { id: userId },
                    data.cardId,
                    Action.ContentEdit,
                ),
                data.cardId,
                data.title,
            ),
        );

        return checklist;
    });

export const renameChecklistServer = createServerFn({ method: 'POST' })
    .validator(z.object({ checklistId: z.uuid(), title: textSchema }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        requireAffected(
            await repo.renameChecklist(
                await authorizeChecklist(
                    { id: userId },
                    data.checklistId,
                    Action.ContentEdit,
                ),
                data.checklistId,
                data.title,
            ),
        );
    });

export const deleteChecklistServer = createServerFn({ method: 'POST' })
    .validator(z.object({ checklistId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        requireAffected(
            await repo.deleteChecklist(
                await authorizeChecklist(
                    { id: userId },
                    data.checklistId,
                    Action.ContentEdit,
                ),
                data.checklistId,
            ),
        );
    });

export const addChecklistItemServer = createServerFn({ method: 'POST' })
    .validator(z.object({ checklistId: z.uuid(), title: textSchema }))
    .handler(async ({ data }) => {
        const item = await writes.addChecklistItemAs(
            await requireUser(),
            data.checklistId,
            data.title,
        );

        return item;
    });

export const updateChecklistItemServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            itemId: z.uuid(),
            title: textSchema.optional(),
            done: z.boolean().optional(),
        }),
    )
    .handler(async ({ data: { itemId, ...patch } }) => {
        const { id: userId } = await requireUser();
        requireAffected(
            await repo.updateChecklistItem(
                await authorizeChecklistItem(
                    { id: userId },
                    itemId,
                    Action.ContentEdit,
                ),
                itemId,
                patch,
            ),
        );
    });

export const deleteChecklistItemServer = createServerFn({ method: 'POST' })
    .validator(z.object({ itemId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        requireAffected(
            await repo.deleteChecklistItem(
                await authorizeChecklistItem(
                    { id: userId },
                    data.itemId,
                    Action.ContentEdit,
                ),
                data.itemId,
            ),
        );
    });

export const moveChecklistItemServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            itemId: z.uuid(),
            prevItemId: z.uuid().nullable(),
            nextItemId: z.uuid().nullable(),
        }),
    )
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        requireAffected(
            await repo.moveChecklistItem(
                await authorizeChecklistItem(
                    { id: userId },
                    data.itemId,
                    Action.ContentEdit,
                ),
                data.itemId,
                data.prevItemId,
                data.nextItemId,
            ),
        );
    });
