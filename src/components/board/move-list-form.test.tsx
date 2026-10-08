import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveListForm } from '#/components/board/move-list-form';
import { boardQueryOptions, boardsListQueryOptions } from '#/lib/boards-query';
import type {
    BoardData,
    BoardSummary,
    ListWithCards,
} from '#/lib/boards-query';

const { getBoardSpy } = vi.hoisted(() => ({
    getBoardSpy: vi.fn<(args: unknown) => Promise<unknown>>(),
}));

vi.mock('#/server/boards', () => ({
    getBoardServer: getBoardSpy,
    listBoardsServer: vi.fn(() => new Promise(() => {})),
}));

// Radix Select needs pointer-capture APIs jsdom doesn't implement; native selects
// are enough to drive onValueChange. Order on screen: board, then position.
vi.mock('#/components/ui/select', () => ({
    Select: ({
        value,
        onValueChange,
        disabled,
        children,
    }: {
        value: string;
        onValueChange: (value: string) => void;
        disabled?: boolean;
        children: ReactNode;
    }) => (
        <select
            value={value}
            disabled={disabled}
            onChange={(e) => onValueChange(e.target.value)}
        >
            {children}
        </select>
    ),
    SelectTrigger: () => null,
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

function makeList(id: string, boardId = 'board-1'): ListWithCards {
    return {
        id,
        boardId,
        position: 'a0',
        title: `List ${id}`,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: [],
    };
}

const current = { id: 'board-1', title: 'Current' };
const lists = [makeList('a'), makeList('b'), makeList('c')];

const boards: Array<BoardSummary> = [
    { id: 'board-1', title: 'Current', listCount: 3, cardCount: 0 },
    { id: 'board-2', title: 'Other', listCount: 2, cardCount: 0 },
    { id: 'board-3', title: 'Slow', listCount: 1, cardCount: 0 },
];

const otherBoard: BoardData = {
    board: {
        id: 'board-2',
        ownerId: 'user-1',
        title: 'Other',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    },
    lists: [makeList('x', 'board-2'), makeList('y', 'board-2')],
};

function setup(
    listId: string,
    { isSyncing = false }: { isSyncing?: boolean } = {},
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(boardsListQueryOptions.queryKey, boards);
    queryClient.setQueryData(boardQueryOptions('board-2').queryKey, otherBoard);
    const onMove = vi.fn();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error(`No list ${listId}`);
    render(
        <QueryClientProvider client={queryClient}>
            <MoveListForm
                list={list}
                board={current}
                lists={lists}
                isSyncing={isSyncing}
                onMove={onMove}
            />
        </QueryClientProvider>,
    );
    const [boardSelect, positionSelect] = screen.getAllByRole('combobox');
    const move = screen.getByRole('button', { name: 'Move' });
    const positions = () =>
        Array.from(
            positionSelect.querySelectorAll('option'),
            (o) => o.textContent,
        );
    return { onMove, boardSelect, positionSelect, move, positions };
}

beforeEach(() => {
    vi.clearAllMocks();
    // Boards other than board-2 stay loading.
    getBoardSpy.mockReturnValue(new Promise(() => {}));
});

describe('MoveListForm', () => {
    it('offers the user boards with the current one selected', () => {
        const { boardSelect } = setup('a');

        expect(boardSelect).toHaveValue('board-1');
        expect(
            Array.from(
                boardSelect.querySelectorAll('option'),
                (o) => o.textContent,
            ),
        ).toEqual(['Current', 'Other', 'Slow']);
    });

    it('offers positions 1..N on the current board, Move off for the current spot', async () => {
        const user = userEvent.setup();
        const { onMove, positionSelect, move, positions } = setup('b');

        expect(positions()).toEqual(['1', '2', '3']);
        await user.selectOptions(positionSelect, '2');
        expect(move).toBeDisabled();

        await user.selectOptions(positionSelect, '3');
        await user.click(move);
        expect(onMove).toHaveBeenCalledWith(current, 2);
    });

    it('offers positions 1..N+1 on another board and resets the position to 1', async () => {
        const user = userEvent.setup();
        const { onMove, boardSelect, positionSelect, move, positions } =
            setup('a');
        await user.selectOptions(positionSelect, '3');

        await user.selectOptions(boardSelect, 'board-2');

        expect(positionSelect).toHaveValue('1');
        expect(positions()).toEqual(['1', '2', '3']);
        expect(move).toBeEnabled();
        await user.selectOptions(positionSelect, '3');
        await user.click(move);
        expect(onMove).toHaveBeenCalledWith(
            { id: 'board-2', title: 'Other' },
            2,
        );
    });

    it('keeps the position and Move off while the other board loads', async () => {
        const user = userEvent.setup();
        const { boardSelect, positionSelect, move } = setup('a');

        await user.selectOptions(boardSelect, 'board-3');

        expect(getBoardSpy).toHaveBeenCalledWith({ data: 'board-3' });
        expect(positionSelect).toBeDisabled();
        expect(move).toBeDisabled();
    });

    it('blocks a move to another board while the list is syncing, not within the board', async () => {
        const user = userEvent.setup();
        const { boardSelect, positionSelect, move } = setup('a', {
            isSyncing: true,
        });

        await user.selectOptions(positionSelect, '2');
        expect(move).toBeEnabled();

        await user.selectOptions(boardSelect, 'board-2');
        expect(move).toBeDisabled();
    });
});
