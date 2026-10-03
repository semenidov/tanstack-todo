import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListSelect } from '#/components/board/list-select';
import type { ListWithCards } from '#/lib/boards-query';

// The real Radix Select (the form and dialog tests swap it for a native one).
// jsdom has no layout, so widths can't be measured: the test checks that the
// selected list name is shrinkable and truncated, with the full name in `title`.

const LONG_TITLE = 'L'.repeat(200);

const lists: Array<ListWithCards> = [
    {
        id: 'a',
        boardId: 'board-1',
        title: LONG_TITLE,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: [],
    },
];

describe('ListSelect with a long list name', () => {
    it('truncates the selected list name and keeps it in the title', () => {
        render(
            <>
                <label htmlFor="list">List</label>
                <ListSelect
                    id="list"
                    lists={lists}
                    value="a"
                    onValueChange={vi.fn()}
                />
            </>,
        );

        const trigger = screen.getByRole('combobox', { name: 'List' });
        expect(trigger).toHaveAttribute('title', LONG_TITLE);
        expect(trigger).toHaveClass('w-full', 'min-w-0');

        const name = within(trigger).getByText(LONG_TITLE);
        expect(name).toHaveClass('min-w-0', 'truncate');
        // The SelectValue box between them shrinks too (styled from the trigger:
        // Radix SelectValue takes no className).
        expect(name.parentElement).toHaveAttribute('data-slot', 'select-value');
        expect(name.parentElement?.parentElement).toBe(trigger);
        expect(trigger).toHaveClass('*:data-[slot=select-value]:min-w-0');
    });
});
