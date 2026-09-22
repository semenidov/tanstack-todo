import { Button } from '#/components/ui/button';
import { Field, FieldError, FieldLabel } from '#/components/ui/field';
import { Input } from '#/components/ui/input';
import { useForm } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import z from 'zod';

const todoSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'write task name')
        .max(500, 'Task name is too long (max 500 characters)'),
});

interface TodoFormProps {
    defaultName: string;
    submitLabel: string;
    pendingLabel: string;
    onSubmit: (name: string) => Promise<void> | void;
    icon?: ReactNode;
}

export function TodoForm({
    defaultName,
    submitLabel,
    pendingLabel,
    onSubmit,
    icon,
}: TodoFormProps) {
    const form = useForm({
        defaultValues: { name: defaultName },
        validators: { onSubmit: todoSchema },
        onSubmit: async ({ value }) => {
            await onSubmit(value.name);
        },
    });

    return (
        <form
            method="post"
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
            className="space-y-4"
        >
            <form.Field
                name="name"
                validators={{ onBlur: todoSchema.shape.name }}
            >
                {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                        <FieldLabel htmlFor={field.name}>Task name</FieldLabel>
                        <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-invalid={field.state.meta.errors.length > 0}
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
                        {icon}
                        {isSubmitting ? pendingLabel : submitLabel}
                    </Button>
                )}
            </form.Subscribe>
        </form>
    );
}
