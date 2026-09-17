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
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
                <TriangleAlertIcon className="size-8 text-destructive" />
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight">
                        Something went wrong
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        We couldn&apos;t load your tasks. Please try again.
                    </p>
                </div>
                <Button onClick={handleRetry}>
                    <RotateCwIcon />
                    Retry
                </Button>
            </div>
        </div>
    );
}
