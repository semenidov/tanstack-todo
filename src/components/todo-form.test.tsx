import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoForm } from '#/components/todo-form';

function renderForm(defaultName = '') {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(
        <TodoForm
            defaultName={defaultName}
            submitLabel="Add"
            pendingLabel="Adding..."
            onSubmit={onSubmit}
        />,
    );
    return { onSubmit };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('TodoForm', () => {
    it('renders the default name and submit label', () => {
        renderForm('Buy milk');
        expect(screen.getByLabelText('Task name')).toHaveValue('Buy milk');
        expect(
            screen.getByRole('button', { name: 'Add' }),
        ).toBeInTheDocument();
    });

    it('does not show an error while typing', async () => {
        const user = userEvent.setup();
        renderForm();
        await user.type(screen.getByLabelText('Task name'), 'a');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows the required error on blur when empty', async () => {
        const user = userEvent.setup();
        renderForm();
        await user.click(screen.getByLabelText('Task name'));
        await user.tab();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'write task name',
        );
    });

    it('submits the entered name', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderForm();
        await user.type(screen.getByLabelText('Task name'), 'Buy milk');
        await user.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Buy milk'));
    });

    it('blocks submit and shows an error when empty', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderForm();
        await user.click(screen.getByRole('button', { name: 'Add' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'write task name',
        );
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
