import { BoardsSkeleton } from '#/components/boards/boards-skeleton';
import { BoardsView } from '#/components/boards/boards-view';
import { RouteError } from '#/components/route-error';
import { boardsListQueryOptions } from '#/lib/boards-query';
import { pageMeta } from '#/lib/seo';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/boards/')({
    component: BoardsPage,
    errorComponent: RouteError,
    pendingComponent: BoardsSkeleton,
    pendingMs: 200,
    pendingMinMs: 300,
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    loader: ({ context }) =>
        context.queryClient.query({
            ...boardsListQueryOptions,
            staleTime: 'static',
        }),
    head: () => ({ meta: pageMeta('Boards') }),
});

function BoardsPage() {
    const { data } = useSuspenseQuery(boardsListQueryOptions);

    return <BoardsView boards={data} />;
}
