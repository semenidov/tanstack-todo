import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps, Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CardItem } from '#/components/board/card-item';
import { useMoveCard } from '#/components/board/card-mutations';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to: _to,
        params: _params,
        ref,
        ...props
    }: ComponentProps<'a'> & {
        to: string;
        params: unknown;
        ref?: Ref<HTMLAnchorElement>;
    }) => <a href="#card" ref={ref} {...props} />,
}));

// The move never answers: the card stays in sync.
vi.mock('#/server/boards', () => ({
    moveCardServer: () => new Promise(() => {}),
    addCardServer: vi.fn(),
    updateCardServer: vi.fn(),
    deleteCardServer: vi.fn(),
    restoreCardServer: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
    useServerFn: (fn: unknown) => fn,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

function makeCard(id: string, listId: string): Card {
    return {
        id,
        listId,
        title: id,
        description: null,
        position: 'a0',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

function makeList(id: string, cardIds: Array<string>): ListWithCards {
    return {
        id,
        boardId: 'board-1',
        title: id,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: cardIds.map((cardId) => makeCard(cardId, id)),
    };
}

const lists = [makeList('a', ['c1', 'c2'])];
const board: BoardData = {
    board: {
        id: 'board-1',
        ownerId: 'user-1',
        title: 'Board',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    },
    lists,
};

function Harness() {
    const { moveCard } = useMoveCard('board-1');
    return (
        <>
            <button type="button" onClick={() => moveCard('c1', 'a', 1)}>
                Move c1 down
            </button>
            <ul>
                <CardItem
                    boardId="board-1"
                    card={makeCard('c1', 'a')}
                    lists={lists}
                />
            </ul>
        </>
    );
}

function renderCard() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(boardQueryOptions('board-1').queryKey, board);
    render(
        <QueryClientProvider client={queryClient}>
            <Harness />
        </QueryClientProvider>,
    );
    return userEvent.setup();
}

const cardRow = () => screen.getByRole('link', { name: 'c1' }).closest('li');

describe('CardItem while its move is saving', () => {
    it('shows the spinner only after 300 ms, with aria-busy', async () => {
        const user = renderCard();

        await user.click(screen.getByRole('button', { name: 'Move c1 down' }));

        expect(
            screen.queryByRole('status', { name: 'Saving card position' }),
        ).toBeNull();
        expect(cardRow()).not.toHaveAttribute('aria-busy');
        expect(
            await screen.findByRole(
                'status',
                { name: 'Saving card position' },
                { timeout: 1000 },
            ),
        ).toBeInTheDocument();
        expect(cardRow()).toHaveAttribute('aria-busy', 'true');
    });

    it('disables Delete while the move is pending', async () => {
        const user = renderCard();

        await user.click(screen.getByRole('button', { name: 'Move c1 down' }));
        await user.click(screen.getByRole('button', { name: 'Card actions' }));

        expect(
            await screen.findByRole('menuitem', { name: 'Delete' }),
        ).toHaveAttribute('aria-disabled', 'true');
    });

    it('keeps Delete enabled without a pending move', async () => {
        const user = renderCard();

        await user.click(screen.getByRole('button', { name: 'Card actions' }));

        expect(
            await screen.findByRole('menuitem', { name: 'Delete' }),
        ).not.toHaveAttribute('aria-disabled');
    });
});
