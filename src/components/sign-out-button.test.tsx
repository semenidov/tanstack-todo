import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignOutButton } from '#/components/sign-out-button';

const mocks = vi.hoisted(() => ({
    isGuest: false,
    signOut: vi.fn(),
    deleteAnonymousUser: vi.fn(),
    navigate: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
}));

vi.mock('#/lib/use-is-guest', () => ({ useIsGuest: () => mocks.isGuest }));
vi.mock('#/lib/auth-client', () => ({
    authClient: {
        signOut: mocks.signOut,
        deleteAnonymousUser: mocks.deleteAnonymousUser,
    },
}));
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: mocks.navigate,
        invalidate: mocks.invalidate,
    }),
}));
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ clear: mocks.clear }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue({ data: {}, error: null });
    mocks.deleteAnonymousUser.mockResolvedValue({ data: {}, error: null });
});

async function signOut() {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
        expect(mocks.navigate).toHaveBeenCalledWith({ to: '/login' }),
    );
}

describe('SignOutButton', () => {
    it('deletes a guest instead of signing it out', async () => {
        mocks.isGuest = true;
        await signOut();

        expect(mocks.deleteAnonymousUser).toHaveBeenCalledTimes(1);
        expect(mocks.signOut).not.toHaveBeenCalled();
        expect(mocks.clear).toHaveBeenCalled();
    });

    it('still signs out a guest that is already deleted', async () => {
        mocks.isGuest = true;
        mocks.deleteAnonymousUser.mockResolvedValue({
            data: null,
            error: { status: 401 },
        });
        await signOut();

        expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });

    it('signs out a regular user without deleting it', async () => {
        mocks.isGuest = false;
        await signOut();

        expect(mocks.signOut).toHaveBeenCalledTimes(1);
        expect(mocks.deleteAnonymousUser).not.toHaveBeenCalled();
    });
});
