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

function overTheWire(kind: QuotaKind, limit: number) {
    return new Error(new QuotaExceededError(kind, limit).message);
}

describe('quotasFor', () => {
    it('selects guest limits for guests and regular limits for registered users', () => {
        expect(quotasFor({ isAnonymous: true })).toEqual(GUEST_QUOTAS);
        expect(quotasFor({ isAnonymous: false })).toEqual(USER_QUOTAS);
    });
});

describe('createErrorMessage', () => {
    it.each([
        [QuotaKind.Boards, /7 boards/],
        [QuotaKind.Lists, /7 lists.*board/],
        [QuotaKind.Cards, /7 cards.*list/],
        [QuotaKind.Labels, /7 labels.*board/],
        [QuotaKind.CardLabels, /7 labels.*card/],
        [QuotaKind.ChecklistItems, /7 items.*checklist/],
    ] as const)(
        'names the %s resource and the limit received from the server',
        (kind, text) => {
            expect(
                createErrorMessage(overTheWire(kind, 7), 'fallback'),
            ).toMatch(text);
        },
    );

    it('returns the fallback for errors that are not recognized quotas', () => {
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
    it('explains the quota blocking Undo using the server limit', () => {
        expect(
            restoreErrorMessage(overTheWire(QuotaKind.Cards, 7), 'fallback'),
        ).toMatch(/restore.*7 cards/i);
    });

    it('returns the fallback for other errors', () => {
        expect(restoreErrorMessage(new Error('network'), 'fallback')).toBe(
            'fallback',
        );
    });
});

describe('moveErrorMessage', () => {
    it.each([
        [QuotaKind.Cards, /list.*7 cards/],
        [QuotaKind.Lists, /board.*7 lists/],
    ] as const)('explains which destination is full for %s', (kind, text) => {
        expect(moveErrorMessage(overTheWire(kind, 7), 'fallback')).toMatch(
            text,
        );
    });

    it('falls back for unsupported quotas and other errors', () => {
        expect(
            moveErrorMessage(overTheWire(QuotaKind.Boards, 7), 'fallback'),
        ).toBe('fallback');
        expect(moveErrorMessage(new Error('Move refused'), 'fallback')).toBe(
            'fallback',
        );
    });
});
