import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { db } from '#/db';

export const getTodosServer = createServerFn({ method: 'GET' }).handler(() => {
    return db.query.todos.findMany({
        orderBy: (t, { asc }) => asc(t.createdAt),
    });
});

export const todosQueryOptions = queryOptions({
    queryKey: ['todos'] as const,
    queryFn: () => getTodosServer(),
});
