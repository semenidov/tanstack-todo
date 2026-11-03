import { BoardSkeleton } from '#/components/board/board-skeleton';
import { BoardView } from '#/components/board/board-view';
import { MessageScreen } from '#/components/message-screen';
import { RouteError } from '#/components/route-error';
import { Button } from '#/components/ui/button';
import { pageMeta } from '#/lib/seo';
import { boardQueryOptions } from '#/lib/boards-query';
import { labelsQueryOptions } from '#/lib/labels-query';
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
import { BOARD_ACCESS_DENIED } from '#/lib/permissions';
import type { ErrorComponentProps } from '@tanstack/react-router';

export const Route = createFileRoute('/b/$boardId')({
    component: BoardPage,
    errorComponent: BoardError,
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
        const [board] = await Promise.all([
            context.queryClient.query({
                ...boardQueryOptions(params.boardId),
                staleTime: 'static',
            }),
            context.queryClient.ensureQueryData(
                labelsQueryOptions(params.boardId),
            ),
        ]);
        if (!board) throw notFound();
        return board;
    },
    head: ({ match, loaderData }) => ({
        meta: pageMeta(
            match.status === 'notFound' || match._notFound
                ? BOARD_ACCESS_DENIED
                : loaderData?.board.title,
        ),
    }),
});

function BoardNotFound() {
    return (
        <MessageScreen
            icon={<SearchXIcon className="size-8 text-muted-foreground" />}
            title={BOARD_ACCESS_DENIED}
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

function BoardError(props: ErrorComponentProps) {
    return props.error instanceof Error &&
        props.error.message === BOARD_ACCESS_DENIED ? (
        <BoardNotFound />
    ) : (
        <RouteError {...props} />
    );
}

function BoardPage() {
    const { boardId } = Route.useParams();
    const { data, error } = useSuspenseQuery(boardQueryOptions(boardId));

    if (error?.message === BOARD_ACCESS_DENIED || !data)
        return <BoardNotFound />;

    return (
        <>
            <BoardView board={data.board} lists={data.lists} />
            <Outlet />
        </>
    );
}
