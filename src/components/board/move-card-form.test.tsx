import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MoveCardForm } from '#/components/board/move-card-form';
import type { Card, ListWithCards } from '#/lib/boards-query';

// Radix Select needs pointer-capture APIs jsdom doesn't implement; native selects
// are enough to drive onValueChange. Order on screen: list, then position.
vi.mock('#/components/ui/select', () => ({
    Select: ({
        value,
        onValueChange,
        children,
    }: {
        value: string;
        onValueChange: (value: string) => void;
        children: ReactNode;
    }) => (
        <select value={value} onChange={(e) => onValueChange(e.target.value)}>
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

function makeCard(id: string, listId: string): Card {
    return {
        id,
        listId,
        title: id,
        description: null,
        completedAt: null,
        dueDate: null,
        dueAt: null,
        labelIds: [],
        position: 'a0',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

function makeList(id: string, cardIds: Array<string>): ListWithCards {
    return {
        id,
        boardId: 'board-1',
        position: 'a0',
        title: `List ${id}`,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: cardIds.map((cardId) => makeCard(cardId, id)),
    };
}

const lists = [makeList('a', ['c1', 'c2', 'c3']), makeList('b', ['d1'])];

function renderForm(cardId: string) {
    const card = lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
    if (!card) throw new Error(`no card ${cardId}`);
    const onMove = vi.fn();
    render(<MoveCardForm card={card} lists={lists} onMove={onMove} />);
    const [listSelect, positionSelect] = screen.getAllByRole('combobox');
    const options = (select: HTMLElement) =>
        Array.from(select.querySelectorAll('option')).map((o) => o.value);
    return { onMove, listSelect, positionSelect, options };
}

describe('MoveCardForm', () => {
    it('defaults to the current list and position 1', () => {
        const { listSelect, positionSelect } = renderForm('c2');

        expect(listSelect).toHaveValue('a');
        expect(positionSelect).toHaveValue('1');
    });

    it('offers 1..N in the current list and 1..N+1 in another one', async () => {
        const user = userEvent.setup();
        const { listSelect, positionSelect, options } = renderForm('c2');

        expect(options(positionSelect)).toEqual(['1', '2', '3']);

        await user.selectOptions(listSelect, 'b');
        expect(options(positionSelect)).toEqual(['1', '2']);
    });

    it('resets the position to 1 when the list changes', async () => {
        const user = userEvent.setup();
        const { listSelect, positionSelect } = renderForm('c2');

        await user.selectOptions(positionSelect, '3');
        await user.selectOptions(listSelect, 'b');

        expect(positionSelect).toHaveValue('1');
    });

    it('disables Move for the same position in the same list', async () => {
        const user = userEvent.setup();
        const { positionSelect } = renderForm('c2');

        await user.selectOptions(positionSelect, '2');

        expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
    });

    it('moves down inside the list to exactly the chosen position', async () => {
        const user = userEvent.setup();
        const { positionSelect, onMove } = renderForm('c1');

        await user.selectOptions(positionSelect, '3');
        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMove).toHaveBeenCalledWith('a', 2);
    });

    it('moves up inside the list to exactly the chosen position', async () => {
        const user = userEvent.setup();
        const { onMove } = renderForm('c3');

        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMove).toHaveBeenCalledWith('a', 0);
    });

    it('moves to the chosen position of another list', async () => {
        const user = userEvent.setup();
        const { listSelect, positionSelect, onMove } = renderForm('c3');

        await user.selectOptions(listSelect, 'b');
        await user.selectOptions(positionSelect, '2');
        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMove).toHaveBeenCalledWith('b', 1);
    });
});
