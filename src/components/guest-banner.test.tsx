import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestBanner } from '#/components/guest-banner';

const isGuest = vi.hoisted(() => ({ value: false }));
vi.mock('#/lib/use-is-guest', () => ({ useIsGuest: () => isGuest.value }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
        <a href={to}>{children}</a>
    ),
}));

describe('GuestBanner', () => {
    it('tells a guest about the lifetime and links to sign-up', () => {
        isGuest.value = true;
        render(<GuestBanner />);

        expect(screen.getByRole('note')).toHaveTextContent(
            'Guest mode - your boards are deleted after 7 days or when you sign out. Create an account to keep your work (guest boards are not transferred).',
        );
        expect(
            screen.getByRole('link', { name: 'Create an account' }),
        ).toHaveAttribute('href', '/signup');
    });

    it('is not shown to a regular user', () => {
        isGuest.value = false;
        const { container } = render(<GuestBanner />);

        expect(container).toBeEmptyDOMElement();
    });
});
