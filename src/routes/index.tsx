import { defaultBoardQueryOptions } from '#/lib/boards-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    loader: async ({ context }) => {
        const board = await context.queryClient.query({
            ...defaultBoardQueryOptions,
            staleTime: 'static',
        });
        throw redirect({ to: '/b/$boardId', params: { boardId: board.id } });
    },
});
