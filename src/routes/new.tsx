import { Button } from '#/components/ui/button';
import { Field, FieldError, FieldLabel } from '#/components/ui/field';
import { Input } from '#/components/ui/input';
import { db } from '#/db';
import { todos } from '#/db/schema';
import { todosQueryOptions } from '#/lib/todos-query';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { ArrowLeftIcon, PlusIcon } from 'lucide-react';
import z from 'zod';

const todoSchema = z.object({
    name: z.string().min(1, 'write task name'),
});

const addTodoServer = createServerFn({ method: 'POST' })
    .validator(z.string().min(1))
    .handler(async ({ data }) => {
        await db.insert(todos).values({ name: data, isComplete: false });
    });
export const Route = createFileRoute('/new')({
    component: NewTodoPage,
});

function NewTodoPage() {
    const addTodo = useServerFn(addTodoServer);
    const queryClient = useQueryClient();
    const navigate = Route.useNavigate();
    const form = useForm({
        defaultValues: { name: '' },
        validators: { onChange: todoSchema },
        onSubmit: async ({ value }) => {
            await addTodo({ data: value.name });
            await queryClient.invalidateQueries({
                queryKey: todosQueryOptions.queryKey,
            });
            await navigate({ to: '/' });
        },
    });

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
                    Add task
                </h1>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    <form.Field name="name">
                        {(field) => (
                            <Field
                                data-invalid={
                                    field.state.meta.errors.length > 0
                                }
                            >
                                <FieldLabel htmlFor={field.name}>
                                    New tasks
                                </FieldLabel>
                                <Input
                                    id={field.name}
                                    name={field.name}
                                    value={field.state.value}
                                    onChange={(e) =>
                                        field.handleChange(e.target.value)
                                    }
                                    onBlur={field.handleBlur}
                                    aria-invalid={
                                        field.state.meta.errors.length > 0
                                    }
                                    autoFocus
                                />
                                <FieldError errors={field.state.meta.errors} />
                            </Field>
                        )}
                    </form.Field>

                    <form.Subscribe
                        selector={(s) => ({
                            canSubmit: s.canSubmit,
                            isSubmitting: s.isSubmitting,
                        })}
                    >
                        {({ canSubmit, isSubmitting }) => (
                            <Button
                                type="submit"
                                disabled={!canSubmit || isSubmitting}
                                className="w-full"
                            >
                                <PlusIcon />
                                {isSubmitting ? 'Adding...' : 'Add'}
                            </Button>
                        )}
                    </form.Subscribe>
                </form>
            </div>
        </div>
    );
}
