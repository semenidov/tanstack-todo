import { queryOptions } from '@tanstack/react-query';
import { getSharingServer } from '#/server/members';

export const membersQueryOptions = (boardId: string) =>
    queryOptions({
        queryKey: ['members', boardId] as const,
        queryFn: () => getSharingServer({ data: { boardId } }),
    });
