import { MessageScreen } from '#/components/message-screen';
import { Button } from '#/components/ui/button';
import * as Sentry from '@sentry/tanstackstart-react';
import { useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect } from 'react';

export function RouteError({ error, reset }: ErrorComponentProps) {
    const router = useRouter();

    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

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
