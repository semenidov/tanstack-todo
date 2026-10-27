import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth-client';
import { useIsGuest } from '#/lib/use-is-guest';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';

export function SignOutButton() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const isGuest = useIsGuest();

    async function handleSignOut() {
        if (isGuest) {
            const { error } = await authClient.deleteAnonymousUser();
            if (error) await authClient.signOut();
        } else {
            await authClient.signOut();
        }
        await router.invalidate();
        await router.navigate({ to: '/login' });
        // After navigation: the next user must not see cached boards, and no mounted
        // query refetches without a session.
        queryClient.clear();
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label="Sign out"
        >
            <LogOutIcon />
        </Button>
    );
}
