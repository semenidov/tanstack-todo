import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth-client';
import { Link, useRouter } from '@tanstack/react-router';
import { LogOutIcon, PlusIcon } from 'lucide-react';

interface TodoHeaderProps {
    completedCount: number;
    totalCount: number;
}

export function TodoHeader({ completedCount, totalCount }: TodoHeaderProps) {
    const router = useRouter();

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
