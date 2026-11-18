import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListSelect } from '#/components/board/list-select';
import type { ListWithCards } from '#/lib/boards-query';

const LONG_TITLE = 'L'.repeat(200);

const lists: Array<ListWithCards> = [
    {
        id: 'a',
        boardId: 'board-1',
        position: 'a0',
        title: LONG_TITLE,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: [],
    },
];

describe('ListSelect with a long list name', () => {
    it('keeps the full selected list name available', () => {
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
    });
});
