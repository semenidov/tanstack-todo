import { requireUser } from '#/lib/auth-server';
import * as writes from '#/server/board-writes';
import * as repo from '#/server/boards-repo';
import { moveCardOrThrow } from '#/server/move-card';
import { moveListOrThrow } from '#/server/move-list';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

const titleSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().max(5000);
// A whole day or an exact moment, never both; both null - no due date.
const dueSchema = z
    .object({
        dueDate: z.iso.date().nullable(),
        dueAt: z.iso.datetime({ offset: true }).nullable(),
    })
    .refine((due) => due.dueDate === null || due.dueAt === null, {
        message: 'A due date is a whole day or a moment, not both',
    });

export const listBoardsServer = createServerFn({ method: 'GET' }).handler(
    async () => {
        const { id: userId } = await requireUser();
        return repo.listBoards(userId);
    },
);

export const createBoardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ title: titleSchema }))
    .handler(async ({ data }) => {
        return writes.createBoardAs(await requireUser(), data.title);
    });

export const renameBoardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ boardId: z.uuid(), title: titleSchema }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.renameBoard(userId, data.boardId, data.title);
    });

export const deleteBoardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ boardId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.deleteBoard(userId, data.boardId);
    });

export const getBoardServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: boardId }) => {
        const { id: userId } = await requireUser();
        return repo.getBoard(userId, boardId);
    });

export const addListServer = createServerFn({ method: 'POST' })
    .validator(z.object({ boardId: z.uuid(), title: titleSchema }))
    .handler(async ({ data }) => {
        return writes.addListAs(await requireUser(), data.boardId, data.title);
    });

export const renameListServer = createServerFn({ method: 'POST' })
    .validator(z.object({ listId: z.uuid(), title: titleSchema }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.renameList(userId, data.listId, data.title);
    });

export const deleteListServer = createServerFn({ method: 'POST' })
    .validator(z.object({ listId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.deleteList(userId, data.listId);
    });

export const restoreListServer = createServerFn({ method: 'POST' })
    .validator(z.object({ listId: z.uuid() }))
    .handler(async ({ data }) => {
        await writes.restoreListAs(await requireUser(), data.listId);
    });

export const addCardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ listId: z.uuid(), title: titleSchema }))
    .handler(async ({ data }) => {
        return writes.addCardAs(await requireUser(), data.listId, data.title);
    });

export const updateCardServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            cardId: z.uuid(),
            title: titleSchema.optional(),
            description: descriptionSchema.nullable().optional(),
            completed: z.boolean().optional(),
            due: dueSchema.optional(),
        }),
    )
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.updateCard(userId, data.cardId, {
            title: data.title,
            description: data.description,
            completed: data.completed,
            due: data.due && {
                dueDate: data.due.dueDate,
                dueAt:
                    data.due.dueAt === null ? null : new Date(data.due.dueAt),
            },
        });
    });

export const moveCardServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            cardId: z.uuid(),
            toListId: z.uuid(),
            prevCardId: z.uuid().nullable(),
            nextCardId: z.uuid().nullable(),
        }),
    )
    .handler(async ({ data }) => moveCardOrThrow(await requireUser(), data));

export const moveListServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            listId: z.uuid(),
            toBoardId: z.uuid(),
            prevListId: z.uuid().nullable(),
            nextListId: z.uuid().nullable(),
        }),
    )
    .handler(async ({ data }) => moveListOrThrow(await requireUser(), data));

export const deleteCardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ cardId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        await repo.deleteCard(userId, data.cardId);
    });

export const restoreCardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ cardId: z.uuid() }))
    .handler(async ({ data }) => {
        await writes.restoreCardAs(await requireUser(), data.cardId);
    });
