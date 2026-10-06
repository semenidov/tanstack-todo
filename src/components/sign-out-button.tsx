import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth-client';
import { useIsGuest } from '#/lib/use-is-guest';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';

/**
 * Sign out for the board pages. A guest is deleted with its data (#84): a plain
 * signOut would leave it until the 7-day cleanup.
 */
export function SignOutButton() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const isGuest = useIsGuest();

    async function handleSignOut() {
        if (isGuest) {
            // The endpoint removes the sessions, the user and the cookie. It
            // fails if the guest is already gone (expired, another tab); then
            // only the cookie is left to clear.
            const { error } = await authClient.deleteAnonymousUser();
            if (error) await authClient.signOut();
        } else {
            await authClient.signOut();
        }
        await router.invalidate();
        await router.navigate({ to: '/login' });
        // The next user (a new guest) must not see this user's cached boards.
        // After the navigation: no mounted query refetches without a session.
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
