import { requireUser } from '#/lib/auth-server';
import { MAX_CHECKLIST_TEXT_LENGTH } from '#/lib/checklist';
import * as writes from '#/server/board-writes';
import * as repo from '#/server/checklists-repo';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

// Server fns of a card's checklist (#120). A refusal (someone else's, deleted,
// a stale order) reaches the client as an error: it shows a toast and refetches.
const textSchema = z.string().trim().min(1).max(MAX_CHECKLIST_TEXT_LENGTH);

export const getChecklistServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: cardId }) => {
        const { id: userId } = await requireUser();
        return repo.getChecklist(userId, cardId);
    });

export const createChecklistServer = createServerFn({ method: 'POST' })
    .validator(z.object({ cardId: z.uuid(), title: textSchema }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        const checklist = await repo.createChecklist(
            userId,
            data.cardId,
            data.title,
        );
        if (!checklist) throw new Error('Checklist was not created');
        return checklist;
    });

export const renameChecklistServer = createServerFn({ method: 'POST' })
    .validator(z.object({ checklistId: z.uuid(), title: textSchema }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        const checklist = await repo.renameChecklist(
            userId,
            data.checklistId,
            data.title,
        );
        if (!checklist) throw new Error('Checklist was not saved');
    });

export const deleteChecklistServer = createServerFn({ method: 'POST' })
    .validator(z.object({ checklistId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.deleteChecklist(userId, data.checklistId);
    });

export const addChecklistItemServer = createServerFn({ method: 'POST' })
    .validator(z.object({ checklistId: z.uuid(), title: textSchema }))
    .handler(async ({ data }) => {
        const item = await writes.addChecklistItemAs(
            await requireUser(),
            data.checklistId,
            data.title,
        );
        if (!item) throw new Error('Item was not added');
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
        const item = await repo.updateChecklistItem(userId, itemId, patch);
        if (!item) throw new Error('Item was not saved');
    });

export const deleteChecklistItemServer = createServerFn({ method: 'POST' })
    .validator(z.object({ itemId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.deleteChecklistItem(userId, data.itemId);
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
        const item = await repo.moveChecklistItem(
            userId,
            data.itemId,
            data.prevItemId,
            data.nextItemId,
        );
        if (!item) throw new Error('Item was not moved');
    });
