import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoHeader } from '#/components/todo-header';

const { signOutSpy, invalidateSpy, navigateSpy } = vi.hoisted(() => ({
    signOutSpy: vi.fn(() => Promise.resolve()),
    invalidateSpy: vi.fn(() => Promise.resolve()),
    navigateSpy: vi.fn(() => Promise.resolve()),
}));

vi.mock('#/lib/auth-client', () => ({
    authClient: { signOut: signOutSpy },
}));

vi.mock('#/server/debug', () => ({
    crashServerFn: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
        <a href={to} {...rest}>
            {children}
        </a>
    ),
    useRouter: () => ({ invalidate: invalidateSpy, navigate: navigateSpy }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('TodoHeader', () => {
    it('shows the completed / total badge', () => {
        render(<TodoHeader completedCount={2} totalCount={5} />);
        expect(screen.getByText(/done/)).toHaveTextContent('2 / 5 done');
    });

    it('hides the badge when there are no todos', () => {
        render(<TodoHeader completedCount={0} totalCount={0} />);
        expect(screen.queryByText(/done/)).toBeNull();
    });

    it('links to the new-task page', () => {
        render(<TodoHeader completedCount={0} totalCount={1} />);
        expect(screen.getByText('Add').closest('a')?.getAttribute('href')).toBe(
            '/new',
        );
    });

    it('signs out and redirects to login', async () => {
        const user = userEvent.setup();
        render(<TodoHeader completedCount={0} totalCount={1} />);

        await user.click(screen.getByLabelText('Sign out'));

        expect(signOutSpy).toHaveBeenCalled();
        expect(invalidateSpy).toHaveBeenCalled();
        expect(navigateSpy).toHaveBeenCalledWith({ to: '/login' });
    });

    it('shows the Sentry test buttons outside production', () => {
        vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'preview');
        render(<TodoHeader completedCount={0} totalCount={1} />);
        expect(screen.getByLabelText('Crash test')).toBeInTheDocument();
        expect(screen.getByLabelText('Server crash test')).toBeInTheDocument();
    });

    it('hides the Sentry test buttons in production', () => {
        vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'production');
        render(<TodoHeader completedCount={0} totalCount={1} />);
        expect(screen.queryByLabelText('Crash test')).toBeNull();
        expect(screen.queryByLabelText('Server crash test')).toBeNull();
    });
});
