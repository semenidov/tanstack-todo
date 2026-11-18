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
    it('keeps Space available for dragging while Enter starts editing', async () => {
        const user = userEvent.setup();
        render(<ControlledListTitle onSave={vi.fn()} />);
        const title = screen.getByRole('button', { name: /To do/ });

        title.focus();
        await user.keyboard(' ');
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

        await user.keyboard('{Enter}');
        expect(screen.getByRole('textbox', { name: 'List title' })).toHaveValue(
            'To do',
        );
    });
});
