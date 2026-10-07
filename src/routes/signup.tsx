import { AuthForm } from '#/components/auth-form';
import { authClient } from '#/lib/auth-client';
import { SIGN_UP_LIMIT, authErrorMessage } from '#/lib/auth-rate-limit';
import { pageMeta } from '#/lib/seo';
import { useQueryClient } from '@tanstack/react-query';
import {
    createFileRoute,
    Link,
    redirect,
    useRouter,
} from '@tanstack/react-router';
import { UserPlusIcon } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/signup')({
    head: () => ({ meta: pageMeta('Sign up') }),
    component: SignupPage,
    beforeLoad: ({ context }) => {
        // A guest may sign up (the banner links here); Better Auth then deletes
        // the guest and its data (#84).
        if (context.session && !context.session.user.isAnonymous) {
            throw redirect({ to: '/' });
        }
    },
});

function SignupPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    async function handleSubmit(values: { email: string; password: string }) {
        const { error } = await authClient.signUp.email({
            ...values,
            name: values.email.split('@')[0] || values.email,
        });
        if (error) {
            toast.error(
                authErrorMessage(error, SIGN_UP_LIMIT, 'Sign up failed'),
            );
            return;
        }
        // A guest's cached boards are gone with the guest.
        queryClient.clear();
        // Re-running this route's beforeLoad redirects the now signed-in user
        // to `/` and on to `/boards`. A separate navigate('/') raced that
        // redirect and could leave the URL at `/`.
        await router.invalidate();
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
                    <Link
                        to="/login"
                        onMouseDown={(e) => e.preventDefault()}
                        className="text-foreground underline"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
