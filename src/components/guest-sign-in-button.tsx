import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth-client';
import { guestSignInErrorMessage } from '#/lib/guest';
import { listBoardsServer } from '#/server/boards';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { UserRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/** "Try as guest" on /login (#84): creates a guest and opens its demo board. */
export function GuestSignInButton() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isPending, setIsPending] = useState(false);

    async function handleClick() {
        // Disabled while pending: a second click would create a second guest.
        setIsPending(true);
        const { error } = await authClient.signIn.anonymous();
        if (error) {
            toast.error(guestSignInErrorMessage(error));
            setIsPending(false);
            return;
        }
        // The sign-in response has no board id; the new guest owns only the
        // demo board, so the list gives it. No board (seeding failed) - /boards.
        queryClient.clear();
        const boards = await listBoardsServer();
        const demo = boards.at(0);
        await router.navigate(
            demo
                ? { to: '/b/$boardId', params: { boardId: demo.id } }
                : { to: '/boards' },
        );
    }

    return (
        <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={handleClick}
        >
            <UserRoundIcon />
            {isPending ? 'Starting...' : 'Try as guest'}
        </Button>
    );
}
