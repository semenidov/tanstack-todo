import { Button } from '#/components/ui/button';
import { useHydrated } from '#/lib/use-hydrated';
import { useIsGuest } from '#/lib/use-is-guest';
import { Link, useRouteContext } from '@tanstack/react-router';
import { XIcon } from 'lucide-react';
import { useState } from 'react';

const dismissedKey = (userId: string) => `guest-banner-dismissed:${userId}`;

function readDismissed(key: string) {
    try {
        return localStorage.getItem(key) !== null;
    } catch {
        return false;
    }
}

/**
 * Guest mode notice on /boards and the board page; nothing for a regular user.
 * Dismissal is kept per guest in localStorage, so it renders only after hydration
 * (no flash for a guest who already closed it).
 */
export function GuestBanner() {
    const isGuest = useIsGuest();
    const userId = useRouteContext({
        from: '__root__',
        select: (context) => context.session?.user.id,
    });
    const hydrated = useHydrated();
    const [dismissed, setDismissed] = useState(false);

    if (!isGuest || !userId || !hydrated) return null;
    const key = dismissedKey(userId);
    if (dismissed || readDismissed(key)) return null;

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(key, '1');
        } catch {
            // Storage unavailable (private mode, quota): hide for this page only.
        }
    };

    return (
        <div
            role="note"
            className="flex items-center gap-2 border-b bg-muted py-1 pr-2 pl-4 text-xs text-muted-foreground"
        >
            <p className="min-w-0 flex-1">
                Guest mode: boards are deleted after 7 days.{' '}
                <Link
                    to="/signup"
                    className="font-medium text-foreground underline"
                >
                    Create an account
                </Link>
            </p>
            <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Dismiss"
                className="shrink-0"
                onClick={dismiss}
            >
                <XIcon />
            </Button>
        </div>
    );
}
