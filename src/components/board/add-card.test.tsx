import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddCard } from '#/components/board/add-card';

const { addCardSpy } = vi.hoisted(() => ({
    addCardSpy: vi.fn(() => Promise.resolve()),
}));

vi.mock('#/server/boards', () => ({
    addCardServer: addCardSpy,
}));

vi.mock('@tanstack/react-start', () => ({
    useServerFn: (fn: unknown) => fn,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

function renderAddCard() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <AddCard boardId="board-1" listId="list-1" />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AddCard', () => {
    it('adds a card on Enter and keeps the field open', async () => {
        const user = userEvent.setup();
        renderAddCard();

        await user.click(screen.getByText('Add card'));
        const input = screen.getByLabelText('New card title');
        await user.type(input, 'Buy milk{Enter}');

        expect(addCardSpy).toHaveBeenCalledWith({
            data: { listId: 'list-1', title: 'Buy milk' },
        });
        expect(screen.getByLabelText('New card title')).toBeInTheDocument();
        expect(screen.getByLabelText('New card title')).toHaveValue('');
    });

    it('closes the field on Escape without adding a card', async () => {
        const user = userEvent.setup();
        renderAddCard();

        await user.click(screen.getByText('Add card'));
        const input = screen.getByLabelText('New card title');
        await user.type(input, 'Buy milk{Escape}');

        expect(addCardSpy).not.toHaveBeenCalled();
        expect(screen.getByText('Add card')).toBeInTheDocument();
    });

    it('does not add an empty card', async () => {
        const user = userEvent.setup();
        renderAddCard();

        await user.click(screen.getByText('Add card'));
        const input = screen.getByLabelText('New card title');
        await user.type(input, '   {Enter}');

        expect(addCardSpy).not.toHaveBeenCalled();
    });
});
