import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardView } from '#/components/board/board-view';
import type { BoardData, ListWithCards } from '#/lib/boards-query';

vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({ invalidate: vi.fn(), navigate: vi.fn() }),
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('#/components/boards/board-mutations', () => ({
    useRenameBoard: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('#/components/sign-out-button', () => ({
    SignOutButton: () => null,
}));
vi.mock('#/components/guest-banner', () => ({
    GuestBanner: () => null,
}));
vi.mock('#/components/theme-toggle', () => ({
    ThemeToggle: () => null,
}));
vi.mock('#/components/board/list-column', () => ({
    ListColumn: ({ list }: { list: ListWithCards }) => (
        <div data-testid={`list-${list.id}`}>{list.title}</div>
    ),
}));
vi.mock('#/components/board/board-dnd', () => ({
    BoardDnd: ({
        lists,
        children,
    }: {
        lists: Array<ListWithCards>;
        children: (props: {
            lists: Array<ListWithCards>;
            isDragging: boolean;
        }) => React.ReactNode;
    }) => children({ lists, isDragging: false }),
}));
vi.mock('#/components/board/add-list', () => ({
    AddList: () => <div data-testid="add-list" />,
}));

const board = { id: 'b1', title: 'Board' } as BoardData['board'];

function makeLists(count: number): ListWithCards[] {
    return Array.from(
        { length: count },
        (_, i) =>
            ({
                id: `l${i + 1}`,
                title: `List ${i + 1}`,
                cards: [],
            }) as unknown as ListWithCards,
    );
}

describe('BoardView scroll to new list', () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
        Element.prototype.scrollIntoView = scrollIntoView;
    });

    afterEach(() => {
        scrollIntoView.mockReset();
    });

    it('does not scroll on the first render', () => {
        render(<BoardView board={board} lists={makeLists(2)} />);

        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls the new last column into view when a list is added', () => {
        const { rerender } = render(
            <BoardView board={board} lists={makeLists(2)} />,
        );

        rerender(<BoardView board={board} lists={makeLists(3)} />);

        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.contexts[0]).toBe(
            screen.getByTestId('list-l3'),
        );
        expect(scrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
        });
    });

    it('does not scroll when a list is removed', () => {
        const { rerender } = render(
            <BoardView board={board} lists={makeLists(3)} />,
        );

        rerender(<BoardView board={board} lists={makeLists(2)} />);

        expect(scrollIntoView).not.toHaveBeenCalled();
    });
});
