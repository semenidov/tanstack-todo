import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EditableTitle } from '#/components/editable-title';

function Harness({
    onSave,
    disabled,
}: {
    onSave: (title: string) => void;
    disabled?: boolean;
}) {
    const [isEditing, setIsEditing] = useState(false);
    return (
        <EditableTitle
            title="Roadmap"
            isEditing={isEditing}
            disabled={disabled}
            aria-label="Title"
            onStartEditing={() => setIsEditing(true)}
            onCancelEditing={() => setIsEditing(false)}
            onSave={onSave}
        />
    );
}

describe('EditableTitle', () => {
    it('saves the trimmed title on Enter', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<Harness onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: 'Roadmap' }));
        await user.clear(screen.getByLabelText('Title'));
        await user.type(screen.getByLabelText('Title'), '  Plan  {Enter}');

        expect(onSave).toHaveBeenCalledExactlyOnceWith('Plan');
        expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    });

    it('cancels on Escape without saving', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<Harness onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: 'Roadmap' }));
        await user.type(screen.getByLabelText('Title'), 'x{Escape}');

        expect(onSave).not.toHaveBeenCalled();
        expect(
            screen.getByRole('button', { name: 'Roadmap' }),
        ).toBeInTheDocument();
    });

    it('does not save an empty or whitespace-only title', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<Harness onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: 'Roadmap' }));
        await user.clear(screen.getByLabelText('Title'));
        await user.type(screen.getByLabelText('Title'), '   {Enter}');

        expect(onSave).not.toHaveBeenCalled();
        expect(
            screen.getByRole('button', { name: 'Roadmap' }),
        ).toBeInTheDocument();
    });

    it('does not enter editing when disabled', async () => {
        const user = userEvent.setup();
        render(<Harness onSave={vi.fn()} disabled />);

        await user.click(screen.getByRole('button', { name: 'Roadmap' }));

        expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    });
});
