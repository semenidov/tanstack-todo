import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from '#/components/auth-form';

function renderForm() {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(
        <AuthForm
            submitLabel="Sign in"
            pendingLabel="Signing in..."
            onSubmit={onSubmit}
        />,
    );
    return { onSubmit };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AuthForm', () => {
    it('renders email, password and submit label', () => {
        renderForm();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Sign in' }),
        ).toBeInTheDocument();
    });

    it('shows an email error on blur for an invalid address', async () => {
        const user = userEvent.setup();
        renderForm();
        await user.type(screen.getByLabelText('Email'), 'not-an-email');
        await user.tab();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Enter a valid email',
        );
    });

    it('shows a password error on blur when too short', async () => {
        const user = userEvent.setup();
        renderForm();
        await user.type(screen.getByLabelText('Password'), 'short');
        await user.tab();
        expect(
            await screen.findByText('Password must be at least 8 characters'),
        ).toBeInTheDocument();
    });

    it('submits email and password when valid', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderForm();
        await user.type(screen.getByLabelText('Email'), 'user@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        await waitFor(() =>
            expect(onSubmit).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: 'password123',
            }),
        );
    });

    it('blocks submit and surfaces a validation error when empty', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderForm();
        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(
            await screen.findByText('Enter a valid email'),
        ).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
