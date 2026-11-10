import { AuthForm } from '#/components/auth-form';
import { GuestSignInButton } from '#/components/guest-sign-in-button';
import { authClient } from '#/lib/auth-client';
import { SIGN_IN_LIMIT, authErrorMessage } from '#/lib/auth-rate-limit';
import { pageMeta } from '#/lib/seo';
import { safeRedirect } from '#/lib/safe-redirect';
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
    validateSearch: (search): { redirect?: string } => ({
        redirect: safeRedirect(search.redirect),
    }),
    component: LoginPage,
    beforeLoad: ({ context, search }) => {
        if (context.session)
            throw redirect(
                search.redirect
                    ? { to: '/', href: search.redirect }
                    : { to: '/' },
            );
    },
});

function LoginPage() {
    const router = useRouter();
    const { redirect: returnPath } = Route.useSearch();

    async function handleSubmit(values: { email: string; password: string }) {
        const { error } = await authClient.signIn.email(values);
        if (error) {
            toast.error(
                authErrorMessage(error, SIGN_IN_LIMIT, 'Sign in failed'),
            );
            return;
        }
        // Let beforeLoad redirect: a separate navigate('/') races it.
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
                <GuestSignInButton redirect={returnPath} />
                <p className="text-center text-sm text-muted-foreground">
                    No account?{' '}
                    <Link
                        to="/signup"
                        search={{ redirect: returnPath }}
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
