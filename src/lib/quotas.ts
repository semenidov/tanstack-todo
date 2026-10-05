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

const QUOTA_TEXT: Record<QuotaKind, (limit: number) => string> = {
    [QuotaKind.Boards]: (n) => `You've reached the limit of ${n} boards.`,
    [QuotaKind.Lists]: (n) =>
        `You've reached the limit of ${n} lists on this board.`,
    [QuotaKind.Cards]: (n) =>
        `You've reached the limit of ${n} cards in this list.`,
};

/** Toast text for a failed create: the quota reason, or `fallback` for any other error. */
export function createErrorMessage(error: unknown, fallback: string) {
    const quota = parseQuotaError(error);
    return quota ? QUOTA_TEXT[quota.kind](quota.limit) : fallback;
}
