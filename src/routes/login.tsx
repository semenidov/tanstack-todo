import { AuthForm } from '#/components/auth-form';
import { authClient } from '#/lib/auth-client';
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router';
import { LogInIcon } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/login')({
    component: LoginPage,
    beforeLoad: ({ context }) => {
        if (context.session) throw redirect({ to: '/' });
    },
});

function LoginPage() {
    const router = useRouter();
    const navigate = Route.useNavigate();

    async function handleSubmit(values: { email: string; password: string }) {
        const { error } = await authClient.signIn.email(values);
        if (error) {
            toast.error(error.message ?? 'Sign in failed');
            return;
        }
        await router.invalidate();
        await navigate({ to: '/' });
    }

    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="mx-auto max-w-sm space-y-6 py-16">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Sign in
                </h1>
                <AuthForm
                    submitLabel="Sign in"
                    pendingLabel="Signing in..."
                    onSubmit={handleSubmit}
                    icon={<LogInIcon />}
                />
                <p className="text-center text-sm text-muted-foreground">
                    No account?{' '}
                    <Link
                        to="/signup"
                        onMouseDown={(e) => e.preventDefault()}
                        className="text-foreground underline"
                    >
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}
