import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListColumn } from '#/components/board/list-column';
import type { ListWithCards } from '#/lib/boards-query';

vi.mock('#/server/boards', () => ({
    renameListServer: vi.fn(() => Promise.resolve()),
    deleteListServer: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tanstack/react-start', () => ({
    useServerFn: (fn: unknown) => fn,
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

function renderListColumn(list: ListWithCards) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <ListColumn boardId="board-1" list={list} allLists={[list]} />
        </QueryClientProvider>,
    );
}

describe('ListColumn', () => {
    it('exposes the list id via data-list-id for scroll targeting', () => {
        const list: ListWithCards = {
            id: 'list-1',
            boardId: 'board-1',
            title: 'To do',
            createdAt: new Date(),
            updatedAt: new Date(),
            cards: [],
        };
        renderListColumn(list);

        expect(
            screen.getByText('To do').closest('[data-list-id]'),
        ).toHaveAttribute('data-list-id', 'list-1');
    });
});
