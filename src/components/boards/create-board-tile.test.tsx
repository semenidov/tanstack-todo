import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QuotaExceededError, QuotaKind } from '#/lib/quotas';
import { CreateBoardTile } from '#/components/boards/create-board-tile';

const { createBoardSpy, navigateSpy } = vi.hoisted(() => ({
    createBoardSpy: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    navigateSpy: vi.fn(() => Promise.resolve()),
}));

vi.mock('#/server/boards', () => ({
    createBoardServer: createBoardSpy,
}));

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigateSpy,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

function renderTile() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    render(
        <QueryClientProvider client={queryClient}>
            <CreateBoardTile />
        </QueryClientProvider>,
    );
}

describe('CreateBoardTile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a board on Enter and opens it', async () => {
        const user = userEvent.setup();
        renderTile();

        await user.click(screen.getByRole('button', { name: /create board/i }));
        await user.type(
            screen.getByLabelText('New board title'),
            ' Plans {Enter}',
        );

        expect(createBoardSpy).toHaveBeenCalledWith({
            data: { title: 'Plans' },
        });
        await vi.waitFor(() =>
            expect(navigateSpy).toHaveBeenCalledWith({
                to: '/b/$boardId',
                params: { boardId: 'new-id' },
            }),
        );
    });

    it('keeps the typed title and shows a toast when the server fails', async () => {
        createBoardSpy.mockRejectedValueOnce(new Error('network'));
        const user = userEvent.setup();
        renderTile();

        await user.click(screen.getByRole('button', { name: /create board/i }));
        const input = screen.getByLabelText('New board title');
        await user.type(input, 'Plans{Enter}');

        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Couldn't create the board. Please try again.",
            ),
        );
        expect(input).toHaveValue('Plans');
        expect(input).not.toHaveAttribute('readonly');
        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('names the board quota and keeps the typed title when the limit is reached', async () => {
        createBoardSpy.mockRejectedValueOnce(
            new Error(new QuotaExceededError(QuotaKind.Boards, 20).message),
        );
        const user = userEvent.setup();
        renderTile();

        await user.click(screen.getByRole('button', { name: /create board/i }));
        const input = screen.getByLabelText('New board title');
        await user.type(input, 'Plans{Enter}');

        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "You've reached the limit of 20 boards.",
            ),
        );
        expect(input).toHaveValue('Plans');
        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('closes on Escape without creating', async () => {
        const user = userEvent.setup();
        renderTile();

        await user.click(screen.getByRole('button', { name: /create board/i }));
        await user.type(screen.getByLabelText('New board title'), 'x{Escape}');

        expect(createBoardSpy).not.toHaveBeenCalled();
        expect(
            screen.getByRole('button', { name: /create board/i }),
        ).toBeInTheDocument();
    });
});
