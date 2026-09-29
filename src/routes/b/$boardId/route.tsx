import { BoardSkeleton } from '#/components/board/board-skeleton';
import { BoardView } from '#/components/board/board-view';
import { MessageScreen } from '#/components/message-screen';
import { RouteError } from '#/components/route-error';
import { Button } from '#/components/ui/button';
import { pageMeta } from '#/lib/seo';
import { boardQueryOptions } from '#/lib/boards-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
    createFileRoute,
    Link,
    notFound,
    Outlet,
    redirect,
} from '@tanstack/react-router';
import { ArrowLeftIcon, SearchXIcon } from 'lucide-react';
import z from 'zod';

export const Route = createFileRoute('/b/$boardId')({
    component: BoardPage,
    errorComponent: RouteError,
    notFoundComponent: BoardNotFound,
    pendingComponent: BoardSkeleton,
    pendingMs: 200,
    pendingMinMs: 300,
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    loader: async ({ context, params }) => {
        if (!z.uuid().safeParse(params.boardId).success) {
            throw notFound();
        }
        const board = await context.queryClient.query({
            ...boardQueryOptions(params.boardId),
            staleTime: 'static',
        });
        if (!board) throw notFound();
        return board;
    },
    head: ({ match, loaderData }) => ({
        meta: pageMeta(
            match.status === 'notFound' || match._notFound
                ? 'Board not found'
                : loaderData?.board.title,
        ),
    }),
});

function BoardNotFound() {
    return (
        <MessageScreen
            icon={<SearchXIcon className="size-8 text-muted-foreground" />}
            title="Board not found"
            description="This board doesn't exist or you don't have access to it."
            action={
                <Button asChild>
                    <Link to="/boards">
                        <ArrowLeftIcon />
                        Back
                    </Link>
                </Button>
            }
        />
    );
}

function BoardPage() {
    const { boardId } = Route.useParams();
    const { data } = useSuspenseQuery(boardQueryOptions(boardId));

    if (!data) return <BoardNotFound />;

    return (
        <>
            <BoardView board={data.board} lists={data.lists} />
            <Outlet />
        </>
    );
}
