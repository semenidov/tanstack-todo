import { getBoardServer, listBoardsServer } from '#/server/boards';
import { queryOptions } from '@tanstack/react-query';

export const boardQueryOptions = (boardId: string) =>
    queryOptions({
        queryKey: ['boards', boardId] as const,
        queryFn: () => getBoardServer({ data: boardId }),
    });

export const boardsListQueryOptions = queryOptions({
    queryKey: ['boards'] as const,
    queryFn: () => listBoardsServer(),
});

export type BoardData = NonNullable<Awaited<ReturnType<typeof getBoardServer>>>;
export type ListWithCards = BoardData['lists'][number];
export type Card = ListWithCards['cards'][number];
