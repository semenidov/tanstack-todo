import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardDialog } from '#/components/board/card-dialog';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

const { updateCardSpy, moveCardSpy, deleteCardSpy, restoreCardSpy } =
    vi.hoisted(() => ({
        updateCardSpy: vi.fn(() => Promise.resolve()),
        moveCardSpy: vi.fn(() => Promise.resolve()),
        deleteCardSpy: vi.fn(() => Promise.resolve()),
        restoreCardSpy: vi.fn(() => Promise.resolve()),
    }));

vi.mock('#/server/boards', () => ({
    updateCardServer: updateCardSpy,
    moveCardServer: moveCardSpy,
    deleteCardServer: deleteCardSpy,
    restoreCardServer: restoreCardSpy,
}));

vi.mock('@tanstack/react-start', () => ({
    useServerFn: (fn: unknown) => fn,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// Radix Select needs pointer-capture APIs jsdom doesn't implement; a plain
// native select is enough to exercise onValueChange from this component.
vi.mock('#/components/ui/select', () => ({
    Select: ({
        value,
        onValueChange,
        children,
    }: {
        value: string;
        onValueChange: (value: string) => void;
        children: ReactNode;
    }) => (
        <select
            aria-label="List"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
        >
            {children}
        </select>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({
        value,
        children,
    }: {
        value: string;
        children: ReactNode;
    }) => <option value={value}>{children}</option>,
}));

const card: Card = {
    id: 'card-1',
    listId: 'list-1',
    title: 'Buy milk',
    description: null,
    completedAt: null,
    dueDate: null,
    dueAt: null,
    position: 'a0',
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

const list: ListWithCards = {
    id: 'list-1',
    boardId: 'board-1',
    position: 'a0',
    title: 'To do',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    cards: [card],
};

const doneList: ListWithCards = {
    id: 'list-2',
    boardId: 'board-1',
    position: 'a0',
    title: 'Done',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    cards: [],
};

function renderDialog() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const boardData: BoardData = {
        board: {
            id: 'board-1',
            ownerId: 'user-1',
            title: 'Board',
            createdAt: new Date(0),
            updatedAt: new Date(0),
        },
        lists: [list, doneList],
    };
    queryClient.setQueryData(boardQueryOptions('board-1').queryKey, boardData);
    return render(
        <QueryClientProvider client={queryClient}>
            <CardDialog
                boardId="board-1"
                card={card}
                list={list}
                lists={[list, doneList]}
                onClose={vi.fn()}
            />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('CardDialog', () => {
    it('cancels the title edit on Escape without saving', async () => {
        const user = userEvent.setup();
        renderDialog();

        await user.click(screen.getByText('Buy milk'));
        const input = screen.getByLabelText('Card title');
        await user.type(input, ' renamed{Escape}');

        expect(updateCardSpy).not.toHaveBeenCalled();
        expect(screen.getByText('Buy milk')).toBeInTheDocument();
    });

    it('saves the description when Save is clicked', async () => {
        const user = userEvent.setup();
        renderDialog();

        const textarea = screen.getByLabelText('Description');
        await user.type(textarea, 'Two liters');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(updateCardSpy).toHaveBeenCalledWith({
            data: { cardId: 'card-1', description: 'Two liters' },
        });
    });

    it('moves the card when a different list is selected', async () => {
        const user = userEvent.setup();
        renderDialog();

        await user.selectOptions(screen.getByLabelText('List'), 'list-2');

        expect(moveCardSpy).toHaveBeenCalledWith({
            data: {
                cardId: 'card-1',
                toListId: 'list-2',
                prevCardId: null,
                nextCardId: null,
            },
        });
    });
});
