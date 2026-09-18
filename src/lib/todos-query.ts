import { getTodoServer, getTodosServer } from '#/server/todos';
import { queryOptions } from '@tanstack/react-query';

export const todosQueryOptions = queryOptions({
    queryKey: ['todos'] as const,
    queryFn: () => getTodosServer(),
});

export const todoQueryOptions = (id: string) =>
    queryOptions({
        queryKey: ['todos', id] as const,
        queryFn: () => getTodoServer({ data: id }),
    });
