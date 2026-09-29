import { AuthForm } from '#/components/auth-form';
import { authClient } from '#/lib/auth-client';
import { pageMeta } from '#/lib/seo';
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
        if (context.session) throw redirect({ to: '/' });
    },
});

function SignupPage() {
    const router = useRouter();

    async function handleSubmit(values: { email: string; password: string }) {
        const { error } = await authClient.signUp.email({
            ...values,
            name: values.email.split('@')[0] || values.email,
        });
        if (error) {
            toast.error(error.message ?? 'Sign up failed');
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
