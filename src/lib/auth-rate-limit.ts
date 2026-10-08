// Shared by the server config (src/lib/auth.ts) and the auth forms, so the
// "try again in ..." text always matches the actual window.

export interface RateLimitRule {
    /** Seconds. */
    window: number;
    max: number;
}

export const SIGN_IN_LIMIT = { window: 60, max: 5 } satisfies RateLimitRule;
export const SIGN_UP_LIMIT = { window: 600, max: 3 } satisfies RateLimitRule;
export const GUEST_SIGN_IN_LIMIT = {
    window: 600,
    max: 3,
} satisfies RateLimitRule;

function retryIn(windowSeconds: number) {
    const minutes = Math.ceil(windowSeconds / 60);
    return minutes === 1 ? 'a minute' : `${minutes} minutes`;
}

/** Toast text for a failed sign-in/sign-up: a 429 gets its own text, the rest - the server message. */
export function authErrorMessage(
    error: { status: number; message?: string },
    limit: RateLimitRule,
    fallback: string,
) {
    if (error.status === 429) {
        return `Too many attempts. Please try again in ${retryIn(limit.window)}.`;
    }
    return error.message || fallback;
}
