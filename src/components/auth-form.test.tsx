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

    it('clears only the focused field error, leaving the other field error intact', async () => {
        const user = userEvent.setup();
        renderForm();

        // Blur both fields with invalid values so each has its own field-level error.
        await user.type(screen.getByLabelText('Email'), 'not-an-email');
        await user.type(screen.getByLabelText('Password'), 'short');
        await user.tab();
        expect(
            await screen.findByText('Password must be at least 8 characters'),
        ).toBeInTheDocument();
        expect(screen.getByText('Enter a valid email')).toBeInTheDocument();

        await user.click(screen.getByLabelText('Email'));

        expect(
            screen.queryByText('Enter a valid email'),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText('Password must be at least 8 characters'),
        ).toBeInTheDocument();
    });

    it('clears the field error when typing a character into it', async () => {
        const user = userEvent.setup();
        renderForm();
        await user.type(screen.getByLabelText('Password'), 'short');
        await user.tab();
        expect(
            await screen.findByText('Password must be at least 8 characters'),
        ).toBeInTheDocument();

        await user.type(screen.getByLabelText('Password'), 'a');

        expect(
            screen.queryByText('Password must be at least 8 characters'),
        ).not.toBeInTheDocument();
    });

    it('shows the error again after resubmitting with an invalid value', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderForm();
        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(
            await screen.findByText('Enter a valid email'),
        ).toBeInTheDocument();

        await user.type(screen.getByLabelText('Email'), 'still-not-an-email');
        expect(
            screen.queryByText('Enter a valid email'),
        ).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(
            await screen.findByText('Enter a valid email'),
        ).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
