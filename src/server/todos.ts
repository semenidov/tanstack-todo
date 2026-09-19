import type { todos } from '#/db/schema';
import { requireUserId } from '#/lib/auth-server';
import * as repo from '#/server/todos-repo';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

export type Todo = typeof todos.$inferSelect;

export const getTodosServer = createServerFn({ method: 'GET' }).handler(
    async () => {
        const userId = await requireUserId();
        return repo.listTodos(userId);
    },
);

export const getTodoServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: id }) => {
        const userId = await requireUserId();
        return repo.getTodo(userId, id);
    });

export const addTodoServer = createServerFn({ method: 'POST' })
    .validator(z.string().trim().min(1).max(500))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.addTodo(userId, data);
    });

export const toggleTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.uuid(), isComplete: z.boolean() }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.toggleTodo(userId, data.id, data.isComplete);
    });

export const deleteTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.uuid() }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.deleteTodo(userId, data.id);
    });

export const updateTodoServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({ id: z.uuid(), name: z.string().trim().min(1).max(500) }),
    )
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        await repo.updateTodo(userId, data.id, data.name);
    });
