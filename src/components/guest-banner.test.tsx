import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuestBanner } from '#/components/guest-banner';

const isGuest = vi.hoisted(() => ({ value: false }));
vi.mock('#/lib/use-is-guest', () => ({ useIsGuest: () => isGuest.value }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
        <a href={to}>{children}</a>
    ),
    useRouteContext: ({
        select,
    }: {
        select: (context: { session: { user: { id: string } } }) => unknown;
    }) => select({ session: { user: { id: 'guest-1' } } }),
}));

describe('GuestBanner', () => {
    afterEach(() => localStorage.clear());

    it('tells a guest about the lifetime and links to sign-up', () => {
        isGuest.value = true;
        render(<GuestBanner />);

        expect(screen.getByRole('note')).toHaveTextContent(
            'Guest mode: boards are deleted after 7 days. Create an account',
        );
        expect(
            screen.getByRole('link', { name: 'Create an account' }),
        ).toHaveAttribute('href', '/signup');
    });

    it('hides for good once dismissed', () => {
        isGuest.value = true;
        const { unmount } = render(<GuestBanner />);

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(screen.queryByRole('note')).not.toBeInTheDocument();
        expect(localStorage.getItem('guest-banner-dismissed:guest-1')).toBe(
            '1',
        );

        unmount();
        render(<GuestBanner />);
        expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });

    it('is not shown to a regular user', () => {
        isGuest.value = false;
        const { container } = render(<GuestBanner />);

        expect(container).toBeEmptyDOMElement();
    });
});
