import { MessageScreen } from '#/components/message-screen';
import { Button } from '#/components/ui/button';
import { useRouter } from '@tanstack/react-router';
import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react';

export function RouteError({ reset }: { reset: () => void }) {
    const router = useRouter();

    async function handleRetry() {
        reset();
        await router.invalidate();
    }

    return (
        <MessageScreen
            icon={<TriangleAlertIcon className="size-8 text-destructive" />}
            title="Something went wrong"
            description="We couldn't load your tasks. Please try again."
            action={
                <Button onClick={handleRetry}>
                    <RotateCwIcon />
                    Retry
                </Button>
            }
        />
    );
}
