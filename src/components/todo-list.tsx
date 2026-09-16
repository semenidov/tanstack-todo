import { Checkbox } from '#/components/ui/checkbox';
import { db } from '#/db';
import { todos } from '#/db/schema';
import { cn } from 'cn';
import { useRouter } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import z from 'zod';

export interface Todo {
    id: string;
    name: string;
    isComplete: boolean;
}

const toggleTodoServer = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string(), isComplete: z.boolean() }))
    .handler(async ({ data }) => {
        await db
            .update(todos)
            .set({ isComplete: data.isComplete })
            .where(eq(todos.id, data.id));
    });

function TodoItem({ todo }: { todo: Todo }) {
    const toggleTodo = useServerFn(toggleTodoServer);
    const router = useRouter();
    const [checked, setChecked] = useState(todo.isComplete);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        setChecked(todo.isComplete);
    }, [todo.isComplete]);

    async function handleChange(next: boolean) {
        setChecked(next);
        setPending(true);
        try {
            await toggleTodo({ data: { id: todo.id, isComplete: next } });
            await router.invalidate();
        } catch {
            setChecked(todo.isComplete);
        } finally {
            setPending(false);
        }
    }

    return (
        <li>
            <label
                className={cn(
                    'group flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm',
                    'transition-all duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99]',
                    checked && 'bg-muted/50',
                )}
            >
                <Checkbox
                    checked={checked}
                    disabled={pending}
                    onCheckedChange={(value) => handleChange(value === true)}
                    className="cursor-pointer"
                />
                <span
                    className={cn(
                        'text-sm transition-colors',
                        checked
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground',
                    )}
                >
                    {todo.name}
                </span>
            </label>
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
