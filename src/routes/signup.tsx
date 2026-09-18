import { AuthForm } from '#/components/auth-form';
import { authClient } from '#/lib/auth-client';
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router';
import { UserPlusIcon } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/signup')({
    component: SignupPage,
    beforeLoad: ({ context }) => {
        if (context.session) throw redirect({ to: '/' });
    },
});

function SignupPage() {
    const router = useRouter();
    const navigate = Route.useNavigate();

    async function handleSubmit(values: { email: string; password: string }) {
        const { error } = await authClient.signUp.email({
            ...values,
            name: values.email.split('@')[0] || values.email,
        });
        if (error) {
            toast.error(error.message ?? 'Sign up failed');
            return;
        }
        await router.invalidate();
        await navigate({ to: '/' });
    }

    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="mx-auto max-w-sm space-y-6 py-16">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Create account
                </h1>
                <AuthForm
                    submitLabel="Sign up"
                    pendingLabel="Creating..."
                    onSubmit={handleSubmit}
                    icon={<UserPlusIcon />}
                />
                <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link to="/login" className="text-foreground underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
