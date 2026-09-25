import { PageShell } from '#/components/page-shell';
import { PageTitle } from '#/components/page-title';
import { TodoForm } from '#/components/todo-form';
import { Button } from '#/components/ui/button';
import { todosQueryOptions } from '#/lib/todos-query';
import { addTodoServer } from '#/server/todos';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeftIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/new')({
    component: NewTodoPage,
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
});

function NewTodoPage() {
    const addTodo = useServerFn(addTodoServer);
    const queryClient = useQueryClient();
    const navigate = Route.useNavigate();

    async function handleSubmit(name: string) {
        try {
            await addTodo({ data: name });
        } catch {
            toast.error('Failed to add task. Please try again.');
            return;
        }
        await queryClient.invalidateQueries({
            queryKey: todosQueryOptions.queryKey,
        });
        toast.success('Task added');
        await navigate({ to: '/' });
    }

    return (
        <PageShell>
            <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link to="/">
                    <ArrowLeftIcon />
                    Back2
                </Link>
            </Button>
            <PageTitle>Add task</PageTitle>

            <TodoForm
                defaultName=""
                submitLabel="Add"
                pendingLabel="Adding..."
                onSubmit={handleSubmit}
                icon={<PlusIcon />}
            />
        </PageShell>
    );
}
