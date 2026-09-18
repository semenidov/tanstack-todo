import { db } from '#/db';
import { todos } from '#/db/schema';
import { requireUserId } from '#/lib/auth-server';
import { checkRateLimit } from '#/server/rate-limit';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import z from 'zod';

export type Todo = typeof todos.$inferSelect;

export const getTodosServer = createServerFn({ method: 'GET' }).handler(
    async () => {
        const userId = await requireUserId();
        return db.query.todos.findMany({
            where: (t) => eq(t.userId, userId),
            orderBy: (t, { asc }) => asc(t.createdAt),
        });
    },
);

export const getTodoServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: id }) => {
        const userId = await requireUserId();
        const todo = await db.query.todos.findFirst({
            where: (t) => and(eq(t.id, id), eq(t.userId, userId)),
        });
        return todo ?? null;
    });

export const addTodoServer = createServerFn({ method: 'POST' })
    .validator(z.string().trim().min(1).max(500))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        checkRateLimit(userId);
        await db
            .insert(todos)
            .values({ name: data, isComplete: false, userId });
    });

export const toggleTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.uuid(), isComplete: z.boolean() }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        checkRateLimit(userId);
        await db
            .update(todos)
            .set({ isComplete: data.isComplete })
            .where(and(eq(todos.id, data.id), eq(todos.userId, userId)));
    });

export const deleteTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.uuid() }))
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        checkRateLimit(userId);
        await db
            .delete(todos)
            .where(and(eq(todos.id, data.id), eq(todos.userId, userId)));
    });

export const updateTodoServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({ id: z.uuid(), name: z.string().trim().min(1).max(500) }),
    )
    .handler(async ({ data }) => {
        const userId = await requireUserId();
        checkRateLimit(userId);
        await db
            .update(todos)
            .set({ name: data.name })
            .where(and(eq(todos.id, data.id), eq(todos.userId, userId)));
    });
