import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteBoardDialog } from '#/components/boards/delete-board-dialog';

function renderDialog(listCount: number, cardCount: number) {
    render(
        <DeleteBoardDialog
            open
            onOpenChange={vi.fn()}
            boardTitle="Roadmap"
            listCount={listCount}
            cardCount={cardCount}
            onConfirm={vi.fn()}
        />,
    );
}

describe('DeleteBoardDialog', () => {
    it('shows the board title and list and card counts', () => {
        renderDialog(3, 12);

        expect(screen.getByText('Delete board "Roadmap"?')).toBeInTheDocument();
        expect(
            screen.getByText(
                'The board, its 3 lists and 12 cards will be permanently deleted.',
            ),
        ).toBeInTheDocument();
    });

    it('uses singular forms for one list and one card', () => {
        renderDialog(1, 1);

        expect(
            screen.getByText(
                'The board, its 1 list and 1 card will be permanently deleted.',
            ),
        ).toBeInTheDocument();
    });

    it('focuses the Cancel button', () => {
        renderDialog(0, 0);

        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
});
