import { Button } from '#/components/ui/button';
import { Field, FieldError, FieldLabel } from '#/components/ui/field';
import { Input } from '#/components/ui/input';
import { useForm } from '@tanstack/react-form';
import type { AnyFieldApi } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import z from 'zod';

const authSchema = z.object({
    email: z.email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

function clearFieldError(field: AnyFieldApi) {
    if (field.state.meta.errors.length === 0) {
        return;
    }
    field.setErrorMap({
        onChange: undefined,
        onBlur: undefined,
        onSubmit: undefined,
        onMount: undefined,
        onDynamic: undefined,
    });
}

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
        // Validate on each field: TanStack Form aborts submit before form-level
        // validators if any field already has an error.
        canSubmitWhenInvalid: true,
        onSubmit: async ({ value }) => {
            await onSubmit(value);
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
                name="email"
                validators={{
                    onBlur: authSchema.shape.email,
                    onSubmit: authSchema.shape.email,
                }}
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
                            onChange={(e) => {
                                clearFieldError(field);
                                field.handleChange(e.target.value);
                            }}
                            onFocus={() => clearFieldError(field)}
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
                validators={{
                    onBlur: authSchema.shape.password,
                    onSubmit: authSchema.shape.password,
                }}
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
                            onChange={(e) => {
                                clearFieldError(field);
                                field.handleChange(e.target.value);
                            }}
                            onFocus={() => clearFieldError(field)}
                            onBlur={field.handleBlur}
                            aria-invalid={field.state.meta.errors.length > 0}
                        />
                        <FieldError errors={field.state.meta.errors} />
                    </Field>
                )}
            </form.Field>

            <form.Subscribe selector={(s) => s.isSubmitting}>
                {(isSubmitting) => (
                    <Button
                        type="submit"
                        disabled={isSubmitting}
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
