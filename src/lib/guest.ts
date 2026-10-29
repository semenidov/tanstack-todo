import { GUEST_SIGN_IN_LIMIT, authErrorMessage } from '#/lib/auth-rate-limit';

export const GUEST_CAP_CODE = 'GUEST_CAP_REACHED';
export const GUEST_CAP_MESSAGE =
    'Guest mode is temporarily unavailable - please create an account.';

export function guestSignInErrorMessage(error: {
    status: number;
    code?: string;
    message?: string;
}) {
    if (error.code === GUEST_CAP_CODE) return GUEST_CAP_MESSAGE;
    return authErrorMessage(
        error,
        GUEST_SIGN_IN_LIMIT,
        'Could not start guest mode',
    );
}
