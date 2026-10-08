// Guest sandbox (#84): shared by the server hook (src/lib/auth.ts) and the
// "Try as guest" button, so the cap error is matched by code, not by text.
import { GUEST_SIGN_IN_LIMIT, authErrorMessage } from '#/lib/auth-rate-limit';

export const GUEST_CAP_CODE = 'GUEST_CAP_REACHED';
export const GUEST_CAP_MESSAGE =
    'Guest mode is temporarily unavailable - please create an account.';

/** Toast text for a failed "Try as guest": rate limit, guest cap, or the server message. */
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
