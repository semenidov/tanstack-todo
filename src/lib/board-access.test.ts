import { describe, expect, it } from 'vitest';
import { BOARD_ACCESS_DENIED, isBoardAccessDenied } from './board-access';

describe('board access errors', () => {
    it('recognizes the uniform denial and preserves unrelated errors', () => {
        expect(isBoardAccessDenied(new Error(BOARD_ACCESS_DENIED))).toBe(true);
        expect(isBoardAccessDenied(new Error('Network failed'))).toBe(false);
        expect(isBoardAccessDenied(null)).toBe(false);
    });
});
