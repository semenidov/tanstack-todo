import { AuthForm } from '#/components/auth-form';
import { PageShell } from '#/components/page-shell';
import { PageTitle } from '#/components/page-title';
import { authClient } from '#/lib/auth-client';
import {
    createFileRoute,
    Link,
    redirect,
    useRouter,
} from '@tanstack/react-router';
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
        <PageShell variant="auth">
            <PageTitle>Sign in</PageTitle>
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
        </PageShell>
    );
}
