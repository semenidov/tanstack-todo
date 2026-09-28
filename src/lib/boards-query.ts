import { getBoardServer, getDefaultBoardServer } from '#/server/boards';
import { queryOptions } from '@tanstack/react-query';

export const boardQueryOptions = (boardId: string) =>
    queryOptions({
        queryKey: ['boards', boardId] as const,
        queryFn: () => getBoardServer({ data: boardId }),
    });

export const defaultBoardQueryOptions = queryOptions({
    queryKey: ['boards', 'default'] as const,
    queryFn: () => getDefaultBoardServer(),
});
