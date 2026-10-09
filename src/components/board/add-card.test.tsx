import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QuotaExceededError, QuotaKind } from '#/lib/quotas';
import { AddCard } from '#/components/board/add-card';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, Card } from '#/lib/boards-query';

const { addCardSpy } = vi.hoisted(() => ({
    addCardSpy: vi.fn<(args: unknown) => Promise<Card | null>>(),
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

const boardKey = boardQueryOptions('board-1').queryKey;

const savedCard: Card = {
    id: 'server-card-id',
    listId: 'list-1',
    title: 'Buy milk',
    description: null,
    completedAt: null,
    dueDate: null,
    dueAt: null,
    labelIds: [],
    position: 'a0',
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

const board: BoardData = {
    board: {
        id: 'board-1',
        ownerId: 'user-1',
        title: 'My tasks',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    },
    lists: [
        {
            id: 'list-1',
            boardId: 'board-1',
            position: 'a0',
            title: 'Todo',
            createdAt: new Date(0),
            updatedAt: new Date(0),
            cards: [],
        },
    ],
};

function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

function renderAddCard() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(boardKey, board);
    render(
        <QueryClientProvider client={queryClient}>
            <AddCard boardId="board-1" listId="list-1" />
        </QueryClientProvider>,
    );
    return queryClient;
}

beforeEach(() => {
    vi.clearAllMocks();
    addCardSpy.mockResolvedValue(savedCard);
});

describe('AddCard', () => {
    it('adds a card on Enter, clears the field after the response and keeps it focused', async () => {
        const user = userEvent.setup();
        const queryClient = renderAddCard();

        await user.click(screen.getByText('Add card'));
        const input = screen.getByLabelText('New card title');
        await user.type(input, 'Buy milk{Enter}');

        expect(addCardSpy).toHaveBeenCalledWith({
            data: { listId: 'list-1', title: 'Buy milk' },
        });
        await vi.waitFor(() => expect(input).toHaveValue(''));
        expect(input).toHaveFocus();
        expect(
            queryClient
                .getQueryData(boardKey)
                ?.lists[0]?.cards.map((c) => c.id),
        ).toEqual(['server-card-id']);
    });

    it('locks the field while the request is pending, so a second Enter adds nothing', async () => {
        const pending = deferred<Card | null>();
        addCardSpy.mockReturnValueOnce(pending.promise);
        const user = userEvent.setup();
        const queryClient = renderAddCard();

        await user.click(screen.getByText('Add card'));
        const input = screen.getByLabelText('New card title');
        await user.type(input, 'Buy milk{Enter}');

        await vi.waitFor(() => expect(input).toHaveAttribute('readonly'));
        expect(input).toHaveAttribute('aria-busy', 'true');
        await user.keyboard('{Enter}');
        expect(addCardSpy).toHaveBeenCalledTimes(1);
        expect(input).toHaveValue('Buy milk');
        expect(queryClient.getQueryData(boardKey)?.lists[0]?.cards).toEqual([]);

        pending.resolve(savedCard);
        await vi.waitFor(() => expect(input).not.toHaveAttribute('readonly'));
        expect(input).toHaveValue('');
    });

    it('keeps the typed text and shows a toast when the server fails', async () => {
        addCardSpy.mockRejectedValueOnce(new Error('network'));
        const user = userEvent.setup();
        const queryClient = renderAddCard();

        await user.click(screen.getByText('Add card'));
        const input = screen.getByLabelText('New card title');
        await user.type(input, 'Buy milk{Enter}');

        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Couldn't add the card. Please try again.",
            ),
        );
        expect(input).toHaveValue('Buy milk');
        expect(queryClient.getQueryData(boardKey)?.lists[0]?.cards).toEqual([]);
    });

    it('names the card quota and keeps the typed text when the limit is reached', async () => {
        addCardSpy.mockRejectedValueOnce(
            new Error(new QuotaExceededError(QuotaKind.Cards, 200).message),
        );
        const user = userEvent.setup();
        renderAddCard();

        await user.click(screen.getByText('Add card'));
        const input = screen.getByLabelText('New card title');
        await user.type(input, 'Buy milk{Enter}');

        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "You've reached the limit of 200 cards in this list.",
            ),
        );
        expect(input).toHaveValue('Buy milk');
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
