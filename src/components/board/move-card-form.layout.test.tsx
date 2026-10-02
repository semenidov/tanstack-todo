import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoveCardForm } from '#/components/board/move-card-form';
import type { Card, ListWithCards } from '#/lib/boards-query';

// The real Radix Select (move-card-form.test.tsx swaps it for a native one).
// jsdom has no layout, so widths can't be measured: the test checks that the
// selected list name is shrinkable and truncated, with the full name in `title`.

const LONG_TITLE = 'L'.repeat(200);

const card: Card = {
    id: 'c1',
    listId: 'a',
    title: 'c1',
    description: null,
    position: 'a0',
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

const lists: Array<ListWithCards> = [
    {
        id: 'a',
        boardId: 'board-1',
        title: LONG_TITLE,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: [card],
    },
];

describe('MoveCardForm with a long list name', () => {
    it('truncates the selected list name and keeps it in the title', () => {
        render(<MoveCardForm card={card} lists={lists} onMove={vi.fn()} />);

        const trigger = screen.getByRole('combobox', { name: 'List' });
        expect(trigger).toHaveAttribute('title', LONG_TITLE);
        expect(trigger).toHaveClass('min-w-0');

        const name = within(trigger).getByText(LONG_TITLE);
        expect(name).toHaveClass('min-w-0', 'truncate');
        // The SelectValue box between them shrinks too (styled from the trigger:
        // Radix SelectValue takes no className).
        expect(name.parentElement).toHaveAttribute('data-slot', 'select-value');
        expect(name.parentElement?.parentElement).toBe(trigger);
        expect(trigger).toHaveClass('*:data-[slot=select-value]:min-w-0');
        // The fields can shrink inside the popover's grid.
        expect(trigger.parentElement).toHaveClass('min-w-0');
    });
});
