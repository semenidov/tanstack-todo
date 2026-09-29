import { boardsListQueryOptions } from '#/lib/boards-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/boards/')({
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    loader: ({ context }) =>
        context.queryClient.query({
            ...boardsListQueryOptions,
            staleTime: 'static',
        }),
    component: BoardsPage,
});

// Placeholder: replaced by the boards page task.
function BoardsPage() {
    const { data } = useSuspenseQuery(boardsListQueryOptions);

    return (
        <main className="mx-auto max-w-3xl p-4">
            <h1 className="text-2xl font-semibold">Boards</h1>
            <ul className="mt-4 flex flex-col gap-2">
                {data.map((board) => (
                    <li key={board.id}>
                        <Link to="/b/$boardId" params={{ boardId: board.id }}>
                            {board.title}
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
