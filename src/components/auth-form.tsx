import { Button } from '#/components/ui/button';
import { Field, FieldError, FieldLabel } from '#/components/ui/field';
import { Input } from '#/components/ui/input';
import { useForm } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import z from 'zod';

const authSchema = z.object({
    email: z.email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

interface AuthFormProps {
    submitLabel: string;
    pendingLabel: string;
    onSubmit: (values: { email: string; password: string }) => Promise<void>;
    icon?: ReactNode;
}

export function AuthForm({
    submitLabel,
    pendingLabel,
    onSubmit,
    icon,
}: AuthFormProps) {
    const form = useForm({
        defaultValues: { email: '', password: '' },
        validators: { onSubmit: authSchema },
        onSubmit: async ({ value }) => {
            await onSubmit(value);
        },
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
            className="space-y-4"
        >
            <form.Field
                name="email"
                validators={{ onBlur: authSchema.shape.email }}
            >
                {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                        <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                        <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            autoComplete="email"
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

            <form.Field
                name="password"
                validators={{ onBlur: authSchema.shape.password }}
            >
                {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                        <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                        <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            autoComplete="current-password"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-invalid={field.state.meta.errors.length > 0}
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
