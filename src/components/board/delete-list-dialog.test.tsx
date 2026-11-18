import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteListDialog } from '#/components/board/delete-list-dialog';

function renderDialog() {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
        <DeleteListDialog
            open
            onOpenChange={onOpenChange}
            listTitle="In progress"
            cardCount={3}
            onConfirm={onConfirm}
        />,
    );
    return { onConfirm, onOpenChange };
}

describe('DeleteListDialog', () => {
    it('identifies the object and the affected content', () => {
        renderDialog();
        const dialog = screen.getByRole('alertdialog', { name: /In progress/ });
        expect(dialog).toHaveAccessibleDescription(/3 cards/);
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
