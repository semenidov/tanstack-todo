import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query';
import { ChecklistSection } from '#/components/board/checklist/checklist-section';
import type { Checklist } from '#/lib/checklist';
import { checklistQueryOptions } from '#/lib/checklist-query';

vi.mock('#/server/boards', () => ({
    getBoardServer: vi.fn(),
    listBoardsServer: vi.fn(),
}));

vi.mock('#/server/checklists', () => ({
    getChecklistServer: vi.fn(),
    createChecklistServer: vi.fn(),
    renameChecklistServer: vi.fn(),
    deleteChecklistServer: vi.fn(),
    addChecklistItemServer: vi.fn(),
    updateChecklistItemServer: vi.fn(),
    deleteChecklistItemServer: vi.fn(),
    moveChecklistItemServer: vi.fn(() => new Promise(() => {})),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const checklist: Checklist = {
    id: 'cl-1',
    cardId: 'card-1',
    title: 'Checklist',
    createdAt: new Date(0),
    items: ['A', 'B', 'C'].map((title, i) => ({
        id: `item-${title}`,
        checklistId: 'cl-1',
        title,
        done: false,
        position: `a${i}`,
        createdAt: new Date(0),
    })),
};

// jsdom has no layout: give each item a row so the keyboard sensor finds the next one.
beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: Element) {
            const li = this.closest('li');
            const index = li?.parentElement
                ? Array.from(li.parentElement.children).indexOf(li)
                : 0;
            return DOMRect.fromRect({
                x: 0,
                y: index * 40,
                width: 200,
                height: 40,
            });
        },
    );
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// The section gets its checklist from the cache, like the card window.
function FromCache() {
    const { data } = useQuery({
        ...checklistQueryOptions('card-1'),
        enabled: false,
    });
    return data ? (
        <ChecklistSection
            boardId="board-1"
            cardId="card-1"
            checklist={data}
            startAdding={false}
        />
    ) : null;
}

const itemNames = () =>
    within(screen.getByRole('list', { name: 'Checklist items' }))
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label'));

// Each key waits a macrotask: the sensor attaches its key listener in a setTimeout.
const press = async (target: Element, code: string) => {
    await act(async () => {
        fireEvent.keyDown(target, { code });
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

it('shows the new order right at the drop, before the cache reaches React', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
        checklistQueryOptions('card-1').queryKey,
        checklist,
    );
    render(
        <QueryClientProvider client={queryClient}>
            <FromCache />
        </QueryClientProvider>,
    );

    const handle = screen.getByRole('button', { name: 'Move item A' });
    handle.focus();
    await press(handle, 'Space');
    await press(handle, 'ArrowDown');

    // TanStack Query notifies subscribers in a setTimeout(0): frozen here.
    vi.useFakeTimers();
    act(() => {
        fireEvent.keyDown(handle, { code: 'Space' });
    });
    expect(itemNames()).toEqual(['B', 'A', 'C']);
});
