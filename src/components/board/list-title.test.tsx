import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ListTitle } from '#/components/board/list-title';

function ControlledListTitle({
    onSave,
    initialTitle = 'To do',
}: {
    onSave: (title: string) => void;
    initialTitle?: string;
}) {
    const [title, setTitle] = useState(initialTitle);
    const [isEditing, setIsEditing] = useState(false);

    return (
        <ListTitle
            title={title}
            count={2}
            isEditing={isEditing}
            onStartEditing={() => setIsEditing(true)}
            onCancelEditing={() => setIsEditing(false)}
            onSave={(next) => {
                setTitle(next);
                onSave(next);
            }}
        />
    );
}

describe('ListTitle', () => {
    it('saves the trimmed title on Enter', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<ControlledListTitle onSave={onSave} />);

        await user.click(screen.getByText('To do'));
        const input = screen.getByLabelText('List title');
        await user.clear(input);
        await user.type(input, '  Doing  {Enter}');

        expect(onSave).toHaveBeenCalledWith('Doing');
        expect(screen.getByText('Doing')).toBeInTheDocument();
    });

    it('cancels without saving on Escape', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<ControlledListTitle onSave={onSave} />);

        await user.click(screen.getByText('To do'));
        const input = screen.getByLabelText('List title');
        await user.type(input, ' renamed{Escape}');

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText('To do')).toBeInTheDocument();
    });

    it('does not save an empty title', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<ControlledListTitle onSave={onSave} />);

        await user.click(screen.getByText('To do'));
        const input = screen.getByLabelText('List title');
        await user.clear(input);
        await user.type(input, '   {Enter}');

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText('To do')).toBeInTheDocument();
    });
});
