import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth-client';
import { guestSignInErrorMessage } from '#/lib/guest';
import { listBoardsServer } from '#/server/boards';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { UserRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function GuestSignInButton() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isPending, setIsPending] = useState(false);

    async function handleClick() {
        // A second click would create a second guest.
        setIsPending(true);
        const { error } = await authClient.signIn.anonymous();
        if (error) {
            toast.error(guestSignInErrorMessage(error));
            setIsPending(false);
            return;
        }
        queryClient.clear();
        let demoId: string | undefined;
        try {
            demoId = (await listBoardsServer()).at(0)?.id;
        } catch {
            demoId = undefined;
        }
        await router.navigate(
            demoId
                ? { to: '/b/$boardId', params: { boardId: demoId } }
                : { to: '/boards' },
        );
    }

    return (
        <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isPending}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClick}
        >
            <UserRoundIcon />
            {isPending ? 'Starting...' : 'Try as guest'}
        </Button>
    );
}
