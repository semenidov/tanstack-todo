import { describe, expect, it } from 'vitest';
import {
    isDuplicateLabelTitle,
    labelsOfCard,
    normalizeLabelTitle,
} from '#/lib/labels';
import type { Label } from '#/lib/labels';

function makeLabel(id: string, title: string | null, createdAt = 0): Label {
    return {
        id,
        boardId: 'board-1',
        title,
        color: 'green',
        createdAt: new Date(createdAt),
    };
}

describe('normalizeLabelTitle', () => {
    it.each([
        ['  Frontend ', 'Frontend'],
        ['', null],
        ['   ', null],
    ])('%j → %j', (raw, expected) => {
        expect(normalizeLabelTitle(raw)).toBe(expected);
    });
});

describe('isDuplicateLabelTitle', () => {
    const labels = [
        makeLabel('a', 'Frontend'),
        makeLabel('b', null),
        makeLabel('c', 'Client A'),
    ];

    it.each([
        ['the same title', 'Frontend', undefined, true],
        ['another case', 'FRONTEND', undefined, true],
        ['a new title', 'Backend', undefined, false],
        ['the label itself on edit', 'frontend', 'a', false],
        ['another label on edit', 'client a', 'a', true],
        ['no title, even next to untitled ones', null, undefined, false],
    ])('%s', (_, title, exceptId, expected) => {
        expect(isDuplicateLabelTitle(labels, title, exceptId)).toBe(expected);
    });
});

describe('labelsOfCard', () => {
    it('keeps the board order of labels, not the order of ids, and skips unknown ids', () => {
        const labels = [makeLabel('a', 'First'), makeLabel('b', 'Second')];
        expect(
            labelsOfCard(labels, ['b', 'gone', 'a']).map((l) => l.id),
        ).toEqual(['a', 'b']);
    });
});
