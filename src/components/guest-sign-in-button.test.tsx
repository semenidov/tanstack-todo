import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestSignInButton } from '#/components/guest-sign-in-button';

const mocks = vi.hoisted(() => ({
    anonymous: vi.fn(),
    listBoards: vi.fn(),
    navigate: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('#/lib/auth-client', () => ({
    authClient: { signIn: { anonymous: mocks.anonymous } },
}));
vi.mock('#/server/boards', () => ({ listBoardsServer: mocks.listBoards }));
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({ navigate: mocks.navigate }),
}));
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ clear: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

/** A promise the test resolves by hand, to hold the request open. */
function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GuestSignInButton', () => {
    it('is blocked while the request runs: two quick clicks make one guest', async () => {
        const request = deferred<{ data: unknown; error: null }>();
        mocks.anonymous.mockReturnValue(request.promise);
        mocks.listBoards.mockResolvedValue([{ id: 'demo' }]);
        render(<GuestSignInButton />);
        const button = screen.getByRole('button', { name: 'Try as guest' });

        await userEvent.dblClick(button);

        expect(mocks.anonymous).toHaveBeenCalledTimes(1);
        expect(button).toBeDisabled();
        request.resolve({ data: {}, error: null });
        await waitFor(() =>
            expect(mocks.navigate).toHaveBeenCalledWith({
                to: '/b/$boardId',
                params: { boardId: 'demo' },
            }),
        );
    });

    it('opens /boards when the demo board is missing', async () => {
        mocks.anonymous.mockResolvedValue({ data: {}, error: null });
        mocks.listBoards.mockResolvedValue([]);
        render(<GuestSignInButton />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Try as guest' }),
        );

        await waitFor(() =>
            expect(mocks.navigate).toHaveBeenCalledWith({ to: '/boards' }),
        );
    });

    it('opens /boards without a toast when the demo board id cannot be read', async () => {
        mocks.anonymous.mockResolvedValue({ data: {}, error: null });
        mocks.listBoards.mockRejectedValue(new Error('Network error'));
        render(<GuestSignInButton />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Try as guest' }),
        );

        await waitFor(() =>
            expect(mocks.navigate).toHaveBeenCalledWith({ to: '/boards' }),
        );
        expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it('shows the rate limit text and unblocks the button', async () => {
        mocks.anonymous.mockResolvedValue({
            data: null,
            error: { status: 429, message: 'Too many requests' },
        });
        render(<GuestSignInButton />);
        const button = screen.getByRole('button', { name: 'Try as guest' });

        await userEvent.click(button);

        expect(mocks.toastError).toHaveBeenCalledWith(
            'Too many attempts. Please try again in 10 minutes.',
        );
        expect(button).toBeEnabled();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});
