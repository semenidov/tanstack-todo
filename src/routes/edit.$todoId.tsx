import { MessageScreen } from '#/components/message-screen';
import { RouteError } from '#/components/route-error';
import { TodoForm } from '#/components/todo-form';
import { Button } from '#/components/ui/button';
import { pageMeta } from '#/lib/seo';
import { todoQueryOptions, todosQueryOptions } from '#/lib/todos-query';
import { updateTodoServer } from '#/server/todos';
import { useQueryClient } from '@tanstack/react-query';
import {
    createFileRoute,
    Link,
    notFound,
    redirect,
} from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeftIcon, CheckIcon, SearchXIcon } from 'lucide-react';
import { toast } from 'sonner';
import z from 'zod';

export const Route = createFileRoute('/edit/$todoId')({
    component: EditTodoPage,
    errorComponent: RouteError,
    notFoundComponent: TaskNotFound,
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    loader: async ({ context, params }) => {
        if (!z.uuid().safeParse(params.todoId).success) {
            throw notFound();
        }
        const todo = await context.queryClient.query({
            ...todoQueryOptions(params.todoId),
            staleTime: 'static',
        });
        if (!todo) throw notFound();
        return todo;
    },
    head: ({ match }) => ({
        meta: pageMeta(
            match.status === 'notFound' || match._notFound
                ? 'Task not found'
                : 'Edit task',
        ),
    }),
});

function TaskNotFound() {
    return (
        <MessageScreen
            icon={<SearchXIcon className="size-8 text-muted-foreground" />}
            title="Task not found"
            description="This task doesn't exist or was deleted."
            action={
                <Button asChild>
                    <Link to="/">
                        <ArrowLeftIcon />
                        Back to list
                    </Link>
                </Button>
            }
        />
    );
}

function EditTodoPage() {
    const { todoId } = Route.useParams();
    const todo = Route.useLoaderData();
    const updateTodo = useServerFn(updateTodoServer);
    const queryClient = useQueryClient();
    const navigate = Route.useNavigate();

    async function handleSubmit(name: string) {
        try {
            await updateTodo({ data: { id: todoId, name } });
        } catch {
            toast.error('Failed to save changes. Please try again.');
            return;
        }
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: todosQueryOptions.queryKey,
            }),
            queryClient.invalidateQueries({
                queryKey: todoQueryOptions(todoId).queryKey,
            }),
        ]);
        toast.success('Task updated');
        await navigate({ to: '/' });
    }

    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="mx-auto max-w-md space-y-6 py-6">
                <Button asChild variant="ghost" size="sm" className="-ml-2">
                    <Link to="/">
                        <ArrowLeftIcon />
                        Back
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Edit task
                </h1>

                <TodoForm
                    defaultName={todo.name}
                    submitLabel="Save"
                    pendingLabel="Saving..."
                    onSubmit={handleSubmit}
                    icon={<CheckIcon />}
                />
            </div>
        </div>
    );
}
