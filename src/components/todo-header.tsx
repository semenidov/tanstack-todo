import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth-client';
import { crashServerFn } from '#/server/debug';
import { Link, useRouter } from '@tanstack/react-router';
import { BugIcon, LogOutIcon, PlusIcon, ServerCrashIcon } from 'lucide-react';
import { toast } from 'sonner';

interface TodoHeaderProps {
    completedCount: number;
    totalCount: number;
}

export function TodoHeader({ completedCount, totalCount }: TodoHeaderProps) {
    const router = useRouter();
    const showDebugTools =
        import.meta.env.VITE_SENTRY_ENVIRONMENT !== 'production';

    async function handleSignOut() {
        await authClient.signOut();
        await router.invalidate();
        await router.navigate({ to: '/login' });
    }

    return (
        <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Todo List
                </h1>
                {totalCount > 0 && (
                    <Badge variant="secondary" className="tabular-nums">
                        {completedCount} / {totalCount} done
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-2">
                {showDebugTools && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                throw new Error('Sentry crash test (client)');
                            }}
                            aria-label="Crash test"
                            title="Crash test (Sentry)"
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <BugIcon />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                                try {
                                    await crashServerFn();
                                } catch {
                                    toast.error('Server crash sent to Sentry');
                                }
                            }}
                            aria-label="Server crash test"
                            title="Server crash test (Sentry)"
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <ServerCrashIcon />
                        </Button>
                    </>
                )}
                <Button asChild size="sm">
                    <Link to="/new">
                        <PlusIcon />
                        Add
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    aria-label="Sign out"
                >
                    <LogOutIcon />
                </Button>
            </div>
        </header>
    );
}
