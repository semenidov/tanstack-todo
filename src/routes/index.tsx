import { TodoHeader } from '#/components/todo-header';
import { TodoList } from '#/components/todo-list';
import { Button } from '#/components/ui/button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '#/components/ui/empty';
import { RouteError } from '#/components/route-error';
import { countCompleted } from '#/lib/todos';
import { todosQueryOptions } from '#/lib/todos-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ListTodo, PlusIcon } from 'lucide-react';

export const Route = createFileRoute('/')({
    component: RouteComponent,
    errorComponent: RouteError,
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

                {totalCount === 0 ? (
                    <Empty className="border bg-card">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ListTodo />
                            </EmptyMedia>
                            <EmptyTitle>List is empty</EmptyTitle>
                            <EmptyDescription>
                                No tasks yet. Add your first one to get started.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button asChild>
                                <Link to="/new">
                                    <PlusIcon />
                                    Add task
                                </Link>
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : (
                    <TodoList todoList={todoList} />
                )}
            </div>
        </div>
    );
}
