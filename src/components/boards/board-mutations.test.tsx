import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLeaveBoard } from './board-mutations';
import { boardQueryOptions, boardsListQueryOptions } from '#/lib/boards-query';
import { BOARD_ACCESS_DENIED } from '#/lib/board-access';
import { Role } from '#/lib/permissions';

const { leave } = vi.hoisted(() => ({ leave: vi.fn() }));
vi.mock('#/server/members', () => ({ leaveBoardServer: leave }));
vi.mock('#/server/boards', () => ({}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const board = {
    id: 'shared',
    title: 'Team',
    myRole: Role.Editor,
    ownerName: 'Owner',
    listCount: 1,
    cardCount: 2,
};
const listKey = boardsListQueryOptions.queryKey;
const boardKey = boardQueryOptions(board.id).queryKey;

function setup() {
    const client = new QueryClient();
    client.setQueryData(listKey, [board]);
    client.setQueryData(boardKey, { board, lists: [] });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useLeaveBoard, { wrapper });
    return { client, result };
}

beforeEach(() => vi.clearAllMocks());

describe('useLeaveBoard', () => {
    it('removes the tile and cached board only after successful Leave', async () => {
        let finish: () => void = () => {};
        leave.mockReturnValue(
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
        );
        const { client, result } = setup();
        act(() => result.current.mutate(board.id));
        await waitFor(() =>
            expect(leave).toHaveBeenCalledWith({ data: { boardId: board.id } }),
        );
        expect(client.getQueryData(listKey)).toEqual([board]);
        await act(async () => finish());
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(client.getQueryData(listKey)).toEqual([]);
        expect(client.getQueryData(boardKey)).toBeUndefined();
    });

    it.each([
        [BOARD_ACCESS_DENIED, BOARD_ACCESS_DENIED],
        ['Network error', "Couldn't leave the board. Please try again."],
    ])('keeps the tile on failure and reports %s', async (error, message) => {
        leave.mockRejectedValue(new Error(error));
        const { client, result } = setup();
        act(() => result.current.mutate(board.id));
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(client.getQueryData(listKey)).toEqual([board]);
        expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
        expect(client.getQueryState(boardKey)?.isInvalidated).toBe(true);
        expect(toast.error).toHaveBeenCalledWith(message);
    });
});
