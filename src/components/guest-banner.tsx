import { useIsGuest } from '#/lib/use-is-guest';
import { Link } from '@tanstack/react-router';

/** Guest mode notice on /boards and the board page; nothing for a regular user. */
export function GuestBanner() {
    const isGuest = useIsGuest();
    if (!isGuest) return null;

    return (
        <p
            role="note"
            className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
            Guest mode - your boards are deleted after 7 days or when you sign
            out.{' '}
            <Link to="/signup" className="font-semibold underline">
                Create an account
            </Link>{' '}
            to keep your work (guest boards are not transferred).
        </p>
    );
}
