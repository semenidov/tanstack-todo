import { requireUserId } from '#/lib/auth-server';
import * as repo from '#/server/boards-repo';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

const titleSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().max(5000);

export const getDefaultBoardServer = createServerFn({ method: 'GET' }).handler(
    async () => {
        const userId = await requireUserId();
        return repo.getDefaultBoard(userId);
    },
);

export const getBoardServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: boardId }) => {
        const userId = await requireUserId();
        return repo.getBoard(userId, boardId);
    });

export const addListServer = createServerFn({ method: 'POST' })
    .validator(z.object({ boardId: z.uuid(), title: titleSchema }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.addList(userId, data.boardId, data.title);
    });

export const renameListServer = createServerFn({ method: 'POST' })
    .validator(z.object({ listId: z.uuid(), title: titleSchema }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.renameList(userId, data.listId, data.title);
    });

export const deleteListServer = createServerFn({ method: 'POST' })
    .validator(z.object({ listId: z.uuid() }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.deleteList(userId, data.listId);
    });

export const addCardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ listId: z.uuid(), title: titleSchema }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.addCard(userId, data.listId, data.title);
    });

export const updateCardServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            cardId: z.uuid(),
            title: titleSchema.optional(),
            description: descriptionSchema.nullable().optional(),
        }),
    )
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.updateCard(userId, data.cardId, {
            title: data.title,
            description: data.description,
        });
    });

export const moveCardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ cardId: z.uuid(), toListId: z.uuid() }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.moveCard(userId, data.cardId, data.toListId);
    });

export const deleteCardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ cardId: z.uuid() }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.deleteCard(userId, data.cardId);
    });
