import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '#/components/ui/alert-dialog';
import { Checkbox } from '#/components/ui/checkbox';
import { db } from '#/db';
import { todos } from '#/db/schema';
import { todosQueryOptions } from '#/lib/todos-query';
import { removeFromList, toggleInList } from '#/lib/todos';
import { cn } from 'cn';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { Trash2 } from 'lucide-react';
import z from 'zod';
import type { InferSelectModel } from 'drizzle-orm';

export type Todo = InferSelectModel<typeof todos>;

const toggleTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string(), isComplete: z.boolean() }))
    .handler(async ({ data }) => {
        await db
            .update(todos)
            .set({ isComplete: data.isComplete })
            .where(eq(todos.id, data.id));
    });

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
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: todosQueryOptions.queryKey,
            });
        },
    });
}

const deleteTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        await db.delete(todos).where(eq(todos.id, data.id));
    });

type DeleteVars = { id: string };
type DeleteContext = { previous: Array<Todo> | undefined };

function useDeleteTodo() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, DeleteVars, DeleteContext>({
        mutationFn: (vars) => deleteTodoServer({ data: vars }),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({
                queryKey: todosQueryOptions.queryKey,
            });
            const previous = queryClient.getQueryData(
                todosQueryOptions.queryKey,
            );
            queryClient.setQueryData(todosQueryOptions.queryKey, (old) =>
                old ? removeFromList(old, vars.id) : old,
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            queryClient.setQueryData(
                todosQueryOptions.queryKey,
                context?.previous,
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: todosQueryOptions.queryKey,
            });
        },
    });
}

function TodoItem({ todo }: { todo: Todo }) {
    const toggle = useToggleTodo();
    const remove = useDeleteTodo();

    return (
        <li>
            <div
                className={cn(
                    'flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm',
                    'transition-all duration-200 hover:border-primary/40 hover:shadow-md',
                    todo.isComplete && 'bg-muted/50',
                )}
            >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <Checkbox
                        checked={todo.isComplete}
                        disabled={toggle.isPending}
                        onCheckedChange={(value) =>
                            toggle.mutate({
                                id: todo.id,
                                isComplete: value === true,
                            })
                        }
                        className="cursor-pointer"
                    />
                    <span
                        className={cn(
                            'truncate text-sm transition-colors',
                            todo.isComplete
                                ? 'text-muted-foreground line-through'
                                : 'text-foreground',
                        )}
                    >
                        {todo.name}
                    </span>
                </label>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            type="button"
                            disabled={remove.isPending}
                            aria-label="Delete task"
                            className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete task?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This task will be permanently deleted. This
                                can&apos;t be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="truncate rounded-md bg-muted px-3 py-2 text-sm font-medium">
                            {todo.name}
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                variant="destructive"
                                onClick={() => remove.mutate({ id: todo.id })}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </li>
    );
}

export function TodoList({ todoList }: { todoList: Array<Todo> }) {
    return (
        <ul className="space-y-2">
            {todoList.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
            ))}
        </ul>
    );
}
