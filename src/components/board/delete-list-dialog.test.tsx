import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteListDialog } from '#/components/board/delete-list-dialog';

describe('DeleteListDialog', () => {
    it('shows the list title and card count in the confirmation text', () => {
        render(
            <DeleteListDialog
                open
                onOpenChange={vi.fn()}
                listTitle="In progress"
                cardCount={3}
                onConfirm={vi.fn()}
            />,
        );

        expect(
            screen.getByText('Delete list "In progress"?'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'The list and its 3 cards will be permanently deleted.',
            ),
        ).toBeInTheDocument();
    });

    it('uses singular "card" for a single card', () => {
        render(
            <DeleteListDialog
                open
                onOpenChange={vi.fn()}
                listTitle="Done"
                cardCount={1}
                onConfirm={vi.fn()}
            />,
        );

        expect(
            screen.getByText(
                'The list and its 1 card will be permanently deleted.',
            ),
        ).toBeInTheDocument();
    });

    it('focuses the Cancel button', () => {
        render(
            <DeleteListDialog
                open
                onOpenChange={vi.fn()}
                listTitle="Done"
                cardCount={0}
                onConfirm={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
});
