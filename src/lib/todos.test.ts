import { describe, expect, it } from 'vitest';
import { countCompleted, removeFromList, toggleInList } from '#/lib/todos';

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

describe('toggleInList', () => {
    const list = [
        { id: '1', isComplete: false },
        { id: '2', isComplete: true },
    ];

    it('flips isComplete of the matching todo', () => {
        expect(toggleInList(list, '1', true)).toEqual([
            { id: '1', isComplete: true },
            { id: '2', isComplete: true },
        ]);
    });

    it('keeps other todos by reference', () => {
        expect(toggleInList(list, '1', true)[1]).toBe(list[1]);
    });

    it('does not mutate the input list', () => {
        const result = toggleInList(list, '1', true);
        expect(result).not.toBe(list);
        expect(list[0].isComplete).toBe(false);
    });
});

describe('removeFromList', () => {
    const list = [{ id: '1' }, { id: '2' }, { id: '3' }];

    it('removes the matching todo', () => {
        expect(removeFromList(list, '2')).toEqual([{ id: '1' }, { id: '3' }]);
    });

    it('returns an equivalent list when id is absent', () => {
        expect(removeFromList(list, 'missing')).toEqual(list);
    });

    it('does not mutate the input list', () => {
        const result = removeFromList(list, '1');
        expect(result).not.toBe(list);
        expect(list).toHaveLength(3);
    });
});
