import { TodoHeader } from '#/components/todo-header';
import { TodoList } from '#/components/todo-list';
import { RouteError } from '#/components/route-error';
import { countCompleted } from '#/lib/todos';
import { todosQueryOptions } from '#/lib/todos-query';
import { pageMeta } from '#/lib/seo';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';

export const Route = createFileRoute('/')({
    head: () => ({ meta: pageMeta('Tasks') }),
    component: RouteComponent,
    errorComponent: RouteError,
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    loader: ({ context }) => {
        return context.queryClient.query({
            ...todosQueryOptions,
            staleTime: 'static',
        });
    },
});

function RouteComponent() {
    const { data: todoList } = useSuspenseQuery(todosQueryOptions);
    const totalCount = todoList.length;
    const completedCount = countCompleted(todoList);

    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="mx-auto max-w-md space-y-6 py-6">
                <TodoHeader
                    completedCount={completedCount}
                    totalCount={totalCount}
                />
                <TodoList todoList={todoList} />
            </div>
        </div>
    );
}
