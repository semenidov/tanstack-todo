import { describe, expect, it } from 'vitest';
import { countCompleted } from '#/lib/todos';

describe('countCompleted', () => {
    it('returns 0 for an empty list', () => {
        expect(countCompleted([])).toBe(0);
    });

    it('counts only completed todos', () => {
        expect(
            countCompleted([
                { isComplete: true },
                { isComplete: false },
                { isComplete: true },
            ]),
        ).toBe(2);
    });

    it('returns 0 when nothing is completed', () => {
        expect(
            countCompleted([{ isComplete: false }, { isComplete: false }]),
        ).toBe(0);
    });
});
