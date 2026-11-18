import { Role } from '#/lib/permissions';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QuotaExceededError, QuotaKind } from '#/lib/quotas';
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
    position: 'a0',
    title: 'Done',
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

const board: BoardData = {
    board: {
        id: 'board-1',
        ownerId: 'user-1',
        myRole: Role.Owner,
        ownerName: 'Owner',
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

const onCreated = vi.fn();

function renderAddList() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(boardKey, board);
    render(
        <QueryClientProvider client={queryClient}>
            <AddList boardId="board-1" onCreated={onCreated} />
        </QueryClientProvider>,
    );
    return queryClient;
}

beforeEach(() => {
    vi.clearAllMocks();
    addListSpy.mockResolvedValue(savedList);
});

describe('AddList', () => {
    it('creates one list after repeated Enter, then clears and refocuses the input', async () => {
        const pending = deferred<SavedList | null>();
        addListSpy.mockReturnValueOnce(pending.promise);
        const user = userEvent.setup();
        const queryClient = renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Enter}');

        await vi.waitFor(() => expect(addListSpy).toHaveBeenCalledTimes(1));
        expect(input).toHaveAttribute('aria-busy', 'true');
        await user.keyboard(' extra{Enter}');
        expect(input).toHaveValue('Done');
        expect(onCreated).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(boardKey)?.lists).toEqual([]);

        pending.resolve(savedList);
        await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
        await vi.waitFor(() => expect(input).toHaveValue(''));
        expect(input).toHaveFocus();
        expect(queryClient.getQueryData(boardKey)?.lists).toEqual([
            { ...savedList, cards: [] },
        ]);
        expect(onCreated).toHaveBeenCalledExactlyOnceWith(savedList.id);
        expect(addListSpy).toHaveBeenCalledExactlyOnceWith({
            data: { boardId: 'board-1', title: 'Done' },
        });
    });

    it('preserves input after failure and allows retrying the save', async () => {
        addListSpy.mockRejectedValueOnce(new Error('network'));
        const user = userEvent.setup();
        const queryClient = renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Enter}');

        await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(input).toHaveValue('Done');
        expect(onCreated).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(boardKey)?.lists).toEqual([]);
        await user.keyboard('{Enter}');
        await vi.waitFor(() => expect(input).toHaveValue(''));
        expect(addListSpy).toHaveBeenCalledTimes(2);
    });

    it('names the list quota and keeps the typed text when the limit is reached', async () => {
        addListSpy.mockRejectedValueOnce(
            new Error(new QuotaExceededError(QuotaKind.Lists, 30).message),
        );
        const user = userEvent.setup();
        renderAddList();

        await user.click(screen.getByText('Add list'));
        const input = screen.getByLabelText('New list title');
        await user.type(input, 'Done{Enter}');

        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                expect.stringMatching(/limit.*30 lists/i),
            ),
        );
        expect(input).toHaveValue('Done');
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
