// Content quotas: checked on the server before every insert (boards-repo), shown to
// the user by the create mutations.

export enum QuotaKind {
    Boards = 'boards',
    Lists = 'lists',
    Cards = 'cards',
}

export type Quotas = Record<QuotaKind, number>;

export const MAX_BOARDS_PER_USER = 20;
export const MAX_LISTS_PER_BOARD = 30;
export const MAX_CARDS_PER_LIST = 200;

export const USER_QUOTAS: Quotas = {
    [QuotaKind.Boards]: MAX_BOARDS_PER_USER,
    [QuotaKind.Lists]: MAX_LISTS_PER_BOARD,
    [QuotaKind.Cards]: MAX_CARDS_PER_LIST,
};

// Guest sandbox (#84): smaller limits, a lifetime and a cap on live guests.
export const GUEST_TTL_DAYS = 7;
export const MAX_ACTIVE_GUESTS = 100;

export const GUEST_QUOTAS: Quotas = {
    [QuotaKind.Boards]: 3,
    [QuotaKind.Lists]: 10,
    [QuotaKind.Cards]: 50,
};

/** Limits for the session user: picked on the server, never sent by the client. */
export function quotasFor(user: { isAnonymous: boolean }): Quotas {
    return user.isAnonymous ? GUEST_QUOTAS : USER_QUOTAS;
}

// A server fn error reaches the client as `new Error(message)` (the rest is
// dropped), so the kind and the limit travel in the message.
const PREFIX = 'quota-exceeded';

export class QuotaExceededError extends Error {
    constructor(kind: QuotaKind, limit: number) {
        super(`${PREFIX}:${kind}:${limit}`);
        this.name = 'QuotaExceededError';
    }
}

function parseQuotaError(
    error: unknown,
): { kind: QuotaKind; limit: number } | undefined {
    if (!(error instanceof Error)) return undefined;
    const [prefix, kind, limit] = error.message.split(':');
    if (prefix !== PREFIX) return undefined;
    const quotaKind = Object.values(QuotaKind).find((k) => k === kind);
    const quotaLimit = Number(limit);
    if (!quotaKind || !Number.isInteger(quotaLimit)) return undefined;
    return { kind: quotaKind, limit: quotaLimit };
}

const QUOTA_LIMIT_TEXT: Record<QuotaKind, (limit: number) => string> = {
    [QuotaKind.Boards]: (n) => `the limit of ${n} boards`,
    [QuotaKind.Lists]: (n) => `the limit of ${n} lists on this board`,
    [QuotaKind.Cards]: (n) => `the limit of ${n} cards in this list`,
};

/** Toast text for a failed create: the quota reason, or `fallback` for any other error. */
export function createErrorMessage(error: unknown, fallback: string) {
    const quota = parseQuotaError(error);
    if (!quota) return fallback;
    return `You've reached ${QUOTA_LIMIT_TEXT[quota.kind](quota.limit)}.`;
}

/** Toast text for a failed Undo (restore of a deleted list or card). */
export function restoreErrorMessage(error: unknown, fallback: string) {
    const quota = parseQuotaError(error);
    if (!quota) return fallback;
    return `Can't restore: you've reached ${QUOTA_LIMIT_TEXT[quota.kind](quota.limit)}.`;
}

/**
 * Toast text for a refused card or list move: only a full target (a list for a
 * card, a board for a list) has its own text.
 */
export function moveErrorMessage(error: unknown, fallback: string) {
    const quota = parseQuotaError(error);
    if (quota?.kind === QuotaKind.Cards) {
        return `Can't move: this list already has ${quota.limit} cards.`;
    }
    if (quota?.kind === QuotaKind.Lists) {
        return `Can't move: this board already has ${quota.limit} lists.`;
    }
    return fallback;
}
