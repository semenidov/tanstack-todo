import { AuthForm } from '#/components/auth-form';
import { GuestSignInButton } from '#/components/guest-sign-in-button';
import { authClient } from '#/lib/auth-client';
import { SIGN_IN_LIMIT, authErrorMessage } from '#/lib/auth-rate-limit';
import { pageMeta } from '#/lib/seo';
import {
    createFileRoute,
    Link,
    redirect,
    useRouter,
} from '@tanstack/react-router';
import { LogInIcon } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/login')({
    head: () => ({ meta: pageMeta('Sign in') }),
    component: LoginPage,
    beforeLoad: ({ context }) => {
        if (context.session) throw redirect({ to: '/' });
    },
});

function LoginPage() {
    const router = useRouter();

    async function handleSubmit(values: { email: string; password: string }) {
        const { error } = await authClient.signIn.email(values);
        if (error) {
            toast.error(
                authErrorMessage(error, SIGN_IN_LIMIT, 'Sign in failed'),
            );
            return;
        }
        // Re-running this route's beforeLoad redirects the now signed-in user
        // to `/` and on to `/boards`. A separate navigate('/') raced that
        // redirect and could leave the URL at `/`.
        await router.invalidate();
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
                <GuestSignInButton />
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
