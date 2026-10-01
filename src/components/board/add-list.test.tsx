import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AddList } from '#/components/board/add-list';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, ListWithCards } from '#/lib/boards-query';

// The server returns the list row without cards.
type SavedList = Omit<ListWithCards, 'cards'>;

const { addListSpy } = vi.hoisted(() => ({
    addListSpy: vi.fn<(args: unknown) => Promise<SavedList | null>>(),
}));

vi.mock('#/server/boards', () => ({
    addListServer: addListSpy,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const boardKey = boardQueryOptions('board-1').queryKey;

const savedList: SavedList = {
    id: 'server-list-id',
    boardId: 'board-1',
    title: 'Done',
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
    lists: [],
};

function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

function renderAddList() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(boardKey, board);
    render(
        <QueryClientProvider client={queryClient}>
            <AddList boardId="board-1" />
        </QueryClientProvider>,
    );
    return queryClient;
}

beforeEach(() => {
    vi.clearAllMocks();
    addListSpy.mockResolvedValue(savedList);
});

describe('AddList', () => {
    it('adds a list on Enter, clears the field after the response and keeps it focused', async () => {
        const user = userEvent.setup();
        const queryClient = renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Enter}');

        expect(addListSpy).toHaveBeenCalledWith({
            data: { boardId: 'board-1', title: 'Done' },
        });
        await vi.waitFor(() => expect(input).toHaveValue(''));
        expect(input).toHaveFocus();
        expect(
            queryClient.getQueryData(boardKey)?.lists.map((l) => l.id),
        ).toEqual(['server-list-id']);
    });

    it('locks the field while the request is pending, so a second Enter adds nothing', async () => {
        const pending = deferred<SavedList | null>();
        addListSpy.mockReturnValueOnce(pending.promise);
        const user = userEvent.setup();
        const queryClient = renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Enter}');

        await vi.waitFor(() => expect(input).toHaveAttribute('readonly'));
        expect(input).toHaveAttribute('aria-busy', 'true');
        await user.keyboard('{Enter}');
        expect(addListSpy).toHaveBeenCalledTimes(1);
        expect(input).toHaveValue('Done');
        expect(queryClient.getQueryData(boardKey)?.lists).toEqual([]);

        pending.resolve(savedList);
        await vi.waitFor(() => expect(input).not.toHaveAttribute('readonly'));
        expect(input).toHaveValue('');
    });

    it('keeps the typed text and shows a toast when the server fails', async () => {
        addListSpy.mockRejectedValueOnce(new Error('network'));
        const user = userEvent.setup();
        const queryClient = renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Enter}');

        await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(input).toHaveValue('Done');
        expect(queryClient.getQueryData(boardKey)?.lists).toEqual([]);
    });

    it('treats a null response (board gone) as an error', async () => {
        addListSpy.mockResolvedValueOnce(null);
        const user = userEvent.setup();
        renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Enter}');

        await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(input).toHaveValue('Done');
    });

    it('closes the field on Escape without adding a list', async () => {
        const user = userEvent.setup();
        renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Escape}');

        expect(addListSpy).not.toHaveBeenCalled();
        expect(screen.getByText('Add list')).toBeInTheDocument();
    });

    it('does not add an empty list', async () => {
        const user = userEvent.setup();
        renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, '   {Enter}');

        expect(addListSpy).not.toHaveBeenCalled();
    });
});
