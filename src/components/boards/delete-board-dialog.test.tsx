import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteBoardDialog } from '#/components/boards/delete-board-dialog';

function renderDialog() {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
        <DeleteBoardDialog
            open
            onOpenChange={onOpenChange}
            boardTitle="Roadmap"
            listCount={3}
            cardCount={12}
            onConfirm={onConfirm}
        />,
    );
    return { onConfirm, onOpenChange };
}

describe('DeleteBoardDialog', () => {
    it('identifies the object and the affected content', () => {
        renderDialog();
        const dialog = screen.getByRole('alertdialog', { name: /Roadmap/ });
        expect(dialog).toHaveAccessibleDescription(/3 lists.*12 cards/);
    });

    it('starts on Cancel and cancels without confirming deletion', async () => {
        const user = userEvent.setup();
        const { onConfirm, onOpenChange } = renderDialog();
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

        await user.keyboard('{Enter}');

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('confirms deletion when Delete is clicked', async () => {
        const user = userEvent.setup();
        const { onConfirm } = renderDialog();

        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
