import { Button } from '#/components/ui/button';
import { Checkbox } from '#/components/ui/checkbox';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '#/components/ui/empty';
import { todosQueryOptions } from '#/lib/todos-query';
import { removeFromList, toggleInList } from '#/lib/todos';
import { deleteTodoServer, toggleTodoServer } from '#/server/todos';
import type { Todo } from '#/server/todos';
import { cn } from 'cn';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ListTodo, PlusIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export type { Todo };

const UNDO_WINDOW_MS = 5000;

type ToggleVars = { id: string; isComplete: boolean };
type ToggleContext = { previous: Array<Todo> | undefined };

function useToggleTodo() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, ToggleVars, ToggleContext>({
        mutationFn: (vars) => toggleTodoServer({ data: vars }),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({
                queryKey: todosQueryOptions.queryKey,
            });
            const previous = queryClient.getQueryData(
                todosQueryOptions.queryKey,
            );
            queryClient.setQueryData(todosQueryOptions.queryKey, (old) =>
                old ? toggleInList(old, vars.id, vars.isComplete) : old,
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            queryClient.setQueryData(
                todosQueryOptions.queryKey,
                context?.previous,
            );
            toast.error("Couldn't update the task. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: todosQueryOptions.queryKey,
            });
        },
    });
}

function useDeleteTodo() {
    const queryClient = useQueryClient();
    const deleteTodo = useServerFn(deleteTodoServer);

    return (todo: Todo) => {
        const key = todosQueryOptions.queryKey;
        const previous = queryClient.getQueryData(key);
        queryClient.setQueryData(key, (old) =>
            old ? removeFromList(old, todo.id) : old,
        );

        let settled = false;
        const restore = () => queryClient.setQueryData(key, previous);

        const commit = async () => {
            if (settled) return;
            settled = true;
            try {
                await deleteTodo({ data: { id: todo.id } });
                queryClient.invalidateQueries({ queryKey: key });
            } catch {
                restore();
                toast.error("Couldn't delete the task. Please try again.");
            }
        };

        const undo = () => {
            if (settled) return;
            settled = true;
            restore();
        };

        toast.warning(`Deleted "${todo.name}"`, {
            icon: <Trash2 className="size-4" />,
            action: { label: 'Undo', onClick: undo },
            duration: UNDO_WINDOW_MS,
            onAutoClose: commit,
            onDismiss: commit,
        });
    };
}

function TodoItem({ todo }: { todo: Todo }) {
    const toggle = useToggleTodo();
    const deleteTodo = useDeleteTodo();

    return (
        <li>
            <div
                className={cn(
                    'relative flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm',
                    'transition-all duration-200 hover:border-primary/40 hover:shadow-md',
                    todo.isComplete && 'bg-muted/50',
                )}
            >
                <Checkbox
                    checked={todo.isComplete}
                    disabled={toggle.isPending}
                    onCheckedChange={(value) =>
                        toggle.mutate({
                            id: todo.id,
                            isComplete: value === true,
                        })
                    }
                    aria-label={
                        todo.isComplete ? 'Mark as not done' : 'Mark as done'
                    }
                    className="cursor-pointer"
                />
                <Link
                    to="/edit/$todoId"
                    params={{ todoId: todo.id }}
                    className={cn(
                        'min-w-0 flex-1 cursor-pointer truncate rounded-sm text-sm transition-colors',
                        todo.isComplete
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground',
                    )}
                >
                    {todo.name}
                </Link>
                <button
                    type="button"
                    onClick={() => deleteTodo(todo)}
                    aria-label="Delete task"
                    className="ml-1 shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                    <Trash2 className="size-4" />
                </button>
            </div>
        </li>
    );
}

export function TodoList({ todoList }: { todoList: Array<Todo> }) {
    if (todoList.length === 0) {
        return (
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
        );
    }

    return (
        <ul className="space-y-2">
            {todoList.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
            ))}
        </ul>
    );
}
