import { describe, expect, it } from 'vitest';
import {
    QuotaExceededError,
    QuotaKind,
    USER_QUOTAS,
    createErrorMessage,
    moveErrorMessage,
    restoreErrorMessage,
} from '#/lib/quotas';

/** What the client gets: a server fn error keeps only its message on the wire. */
function overTheWire(error: Error) {
    return new Error(error.message);
}

describe('USER_QUOTAS', () => {
    it('limits boards, lists and cards', () => {
        expect(USER_QUOTAS).toEqual({
            [QuotaKind.Boards]: 20,
            [QuotaKind.Lists]: 30,
            [QuotaKind.Cards]: 200,
        });
    });
});

describe('createErrorMessage', () => {
    it.each([
        [QuotaKind.Boards, 20, "You've reached the limit of 20 boards."],
        [
            QuotaKind.Lists,
            30,
            "You've reached the limit of 30 lists on this board.",
        ],
        [
            QuotaKind.Cards,
            200,
            "You've reached the limit of 200 cards in this list.",
        ],
    ])('names the %s quota from the server error', (kind, limit, text) => {
        const error = overTheWire(new QuotaExceededError(kind, limit));

        expect(createErrorMessage(error, 'fallback')).toBe(text);
    });

    it('takes the limit from the error, not from the defaults', () => {
        const error = overTheWire(new QuotaExceededError(QuotaKind.Boards, 3));

        expect(createErrorMessage(error, 'fallback')).toBe(
            "You've reached the limit of 3 boards.",
        );
    });

    it('returns the fallback for any other error', () => {
        expect(createErrorMessage(new Error('network'), 'fallback')).toBe(
            'fallback',
        );
        expect(createErrorMessage('oops', 'fallback')).toBe('fallback');
        expect(
            createErrorMessage(
                new Error('quota-exceeded:unknown:5'),
                'fallback',
            ),
        ).toBe('fallback');
    });
});

describe('restoreErrorMessage', () => {
    it.each([
        [
            QuotaKind.Lists,
            30,
            "Can't restore: you've reached the limit of 30 lists on this board.",
        ],
        [
            QuotaKind.Cards,
            200,
            "Can't restore: you've reached the limit of 200 cards in this list.",
        ],
    ])('names the %s quota that blocks Undo', (kind, limit, text) => {
        const error = overTheWire(new QuotaExceededError(kind, limit));

        expect(restoreErrorMessage(error, 'fallback')).toBe(text);
    });

    it('returns the fallback for any other error', () => {
        expect(restoreErrorMessage(new Error('network'), 'fallback')).toBe(
            'fallback',
        );
    });
});

describe('moveErrorMessage', () => {
    it('says the target list is full', () => {
        const error = overTheWire(new QuotaExceededError(QuotaKind.Cards, 200));

        expect(moveErrorMessage(error, 'fallback')).toBe(
            "Can't move: this list already has 200 cards.",
        );
    });

    it('returns the fallback for any other error', () => {
        expect(
            moveErrorMessage(new Error('Card was not moved'), 'fallback'),
        ).toBe('fallback');
    });
});
