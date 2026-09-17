import { RouteError } from '#/components/route-error';
import { TodoForm } from '#/components/todo-form';
import { Button } from '#/components/ui/button';
import { db } from '#/db';
import { todos } from '#/db/schema';
import { todoQueryOptions, todosQueryOptions } from '#/lib/todos-query';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { ArrowLeftIcon, CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import z from 'zod';

const updateTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string(), name: z.string().min(1) }))
    .handler(async ({ data }) => {
        await db
            .update(todos)
            .set({ name: data.name })
            .where(eq(todos.id, data.id));
    });

export const Route = createFileRoute('/edit/$todoId')({
    component: EditTodoPage,
    errorComponent: RouteError,
    loader: ({ context, params }) => {
        return context.queryClient.query({
            ...todoQueryOptions(params.todoId),
            staleTime: 'static',
        });
    },
});

function EditTodoPage() {
    const { todoId } = Route.useParams();
    const { data: todo } = useSuspenseQuery(todoQueryOptions(todoId));
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

                {todo ? (
                    <TodoForm
                        defaultName={todo.name}
                        submitLabel="Save"
                        pendingLabel="Saving..."
                        onSubmit={handleSubmit}
                        icon={<CheckIcon />}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Task not found.
                    </p>
                )}
            </div>
        </div>
    );
}
