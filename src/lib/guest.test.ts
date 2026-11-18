import { describe, expect, it } from 'vitest';
import { GUEST_CAP_CODE, guestSignInErrorMessage } from '#/lib/guest';

describe('guestSignInErrorMessage', () => {
    it('asks to retry in 10 minutes when guest sign-in is rate limited', () => {
        expect(
            guestSignInErrorMessage({
                status: 429,
                message: 'Too many requests. Please try again later.',
            }),
        ).toMatch(/10 minutes/);
    });

    it('asks to create an account when the guest cap is reached', () => {
        expect(
            guestSignInErrorMessage({
                status: 503,
                code: GUEST_CAP_CODE,
                message: 'anything',
            }),
        ).toMatch(/create an account/i);
    });

    it('falls back for other errors without a message', () => {
        expect(guestSignInErrorMessage({ status: 500 })).toBe(
            'Could not start guest mode',
        );
    });
});
