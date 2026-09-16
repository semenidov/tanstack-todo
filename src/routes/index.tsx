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
import { db } from '#/db';
import { countCompleted } from '#/lib/todos';
import { Link, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ListTodo, PlusIcon } from 'lucide-react';

const serverLoader = createServerFn({ method: 'GET' }).handler(() => {
    return db.query.todos.findMany({
        orderBy: (t, { asc }) => asc(t.createdAt),
    });
});

export const Route = createFileRoute('/')({
    component: RouteComponent,
    loader: () => {
        return serverLoader();
    },
});

function RouteComponent() {
    const todoList = Route.useLoaderData();
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
