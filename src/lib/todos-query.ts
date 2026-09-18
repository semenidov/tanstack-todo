import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { db } from '#/db';
import { requireUserId } from '#/lib/auth-server';
import z from 'zod';

export const getTodosServer = createServerFn({ method: 'GET' }).handler(
    async () => {
        const userId = await requireUserId();
        return db.query.todos.findMany({
            where: (t, { eq }) => eq(t.userId, userId),
            orderBy: (t, { asc }) => asc(t.createdAt),
        });
    },
);

export const todosQueryOptions = queryOptions({
    queryKey: ['todos'] as const,
    queryFn: () => getTodosServer(),
});

export const getTodoServer = createServerFn({ method: 'GET' })
    .validator(z.uuid())
    .handler(async ({ data: id }) => {
        const userId = await requireUserId();
        const todo = await db.query.todos.findFirst({
            where: (t, { eq, and }) => and(eq(t.id, id), eq(t.userId, userId)),
        });
        return todo ?? null;
    });

export const todoQueryOptions = (id: string) =>
    queryOptions({
        queryKey: ['todos', id] as const,
        queryFn: () => getTodoServer({ data: id }),
    });
