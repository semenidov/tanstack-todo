import { describe, expect, it } from 'vitest';
import {
    SIGN_IN_LIMIT,
    SIGN_UP_LIMIT,
    authErrorMessage,
} from '#/lib/auth-rate-limit';

const rateLimited = {
    status: 429,
    message: 'Too many requests. Please try again later.',
};

describe('authErrorMessage', () => {
    it('asks to retry in a minute when sign-in is rate limited', () => {
        expect(
            authErrorMessage(rateLimited, SIGN_IN_LIMIT, 'Sign in failed'),
        ).toBe('Too many attempts. Please try again in a minute.');
    });

    it('names the sign-up window when sign-up is rate limited', () => {
        expect(
            authErrorMessage(rateLimited, SIGN_UP_LIMIT, 'Sign up failed'),
        ).toBe('Too many attempts. Please try again in 10 minutes.');
    });

    it('keeps the server message for other errors', () => {
        expect(
            authErrorMessage(
                { status: 401, message: 'Invalid email or password' },
                SIGN_IN_LIMIT,
                'Sign in failed',
            ),
        ).toBe('Invalid email or password');
    });

    it('falls back when the server sent no message', () => {
        expect(
            authErrorMessage({ status: 500 }, SIGN_IN_LIMIT, 'Sign in failed'),
        ).toBe('Sign in failed');
    });
});
