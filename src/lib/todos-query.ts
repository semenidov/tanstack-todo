import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { db } from '#/db';
import z from 'zod';

export const getTodosServer = createServerFn({ method: 'GET' }).handler(() => {
    return db.query.todos.findMany({
        orderBy: (t, { asc }) => asc(t.createdAt),
    });
});

export const todosQueryOptions = queryOptions({
    queryKey: ['todos'] as const,
    queryFn: () => getTodosServer(),
});

export const getTodoServer = createServerFn({ method: 'GET' })
    .validator(z.string())
    .handler(({ data: id }) => {
        return db.query.todos.findFirst({
            where: (t, { eq }) => eq(t.id, id),
        });
    });

export const todoQueryOptions = (id: string) =>
    queryOptions({
        queryKey: ['todos', id] as const,
        queryFn: () => getTodoServer({ data: id }),
    });
