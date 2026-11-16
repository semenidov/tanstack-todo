import { queryOptions } from '@tanstack/react-query';
import { getInviteServer, getSharingServer } from '#/server/members';

export const membersQueryOptions = (boardId: string) =>
    queryOptions({
        queryKey: ['members', boardId] as const,
        queryFn: () => getSharingServer({ data: { boardId } }),
    });

export const inviteQueryOptions = (token: string) =>
    queryOptions({
        queryKey: ['invite', token] as const,
        queryFn: () => getInviteServer({ data: { token } }),
        staleTime: 0,
        retry: false,
    });
