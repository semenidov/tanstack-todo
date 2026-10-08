import { describe, expect, it } from 'vitest';
import {
    GUEST_QUOTAS,
    QuotaExceededError,
    QuotaKind,
    USER_QUOTAS,
    createErrorMessage,
    moveErrorMessage,
    quotasFor,
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

describe('GUEST_QUOTAS', () => {
    it('limits a guest to 3 boards, 10 lists per board and 50 cards per list', () => {
        expect(GUEST_QUOTAS).toEqual({
            [QuotaKind.Boards]: 3,
            [QuotaKind.Lists]: 10,
            [QuotaKind.Cards]: 50,
        });
    });

    it('shows the guest numbers in the toasts', () => {
        const error = (kind: QuotaKind) =>
            overTheWire(new QuotaExceededError(kind, GUEST_QUOTAS[kind]));

        expect(createErrorMessage(error(QuotaKind.Boards), 'x')).toBe(
            "You've reached the limit of 3 boards.",
        );
        expect(restoreErrorMessage(error(QuotaKind.Lists), 'x')).toBe(
            "Can't restore: you've reached the limit of 10 lists on this board.",
        );
        expect(moveErrorMessage(error(QuotaKind.Cards), 'x')).toBe(
            "Can't move: this list already has 50 cards.",
        );
        expect(moveErrorMessage(error(QuotaKind.Lists), 'x')).toBe(
            "Can't move: this board already has 10 lists.",
        );
    });
});

describe('moveErrorMessage', () => {
    it('says the target board is full for a refused list move', () => {
        const error = overTheWire(new QuotaExceededError(QuotaKind.Lists, 30));
        expect(moveErrorMessage(error, 'fallback')).toBe(
            "Can't move: this board already has 30 lists.",
        );
    });

    it('falls back for a board quota or any other error', () => {
        const boards = overTheWire(
            new QuotaExceededError(QuotaKind.Boards, 20),
        );
        expect(moveErrorMessage(boards, 'fallback')).toBe('fallback');
        expect(
            moveErrorMessage(new Error('List was not moved'), 'fallback'),
        ).toBe('fallback');
    });
});

describe('quotasFor', () => {
    it('gives a guest the guest limits', () => {
        expect(quotasFor({ isAnonymous: true })).toBe(GUEST_QUOTAS);
    });

    it('gives a regular user the regular limits', () => {
        expect(quotasFor({ isAnonymous: false })).toBe(USER_QUOTAS);
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
