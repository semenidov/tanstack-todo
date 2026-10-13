import type { Active, ClientRect, Over } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import {
    isListId,
    listDndAnnouncements,
    listDropIndex,
    listKeyboardPoint,
    pickListDropId,
} from '#/lib/list-dnd';
import type { Card, ListWithCards } from '#/lib/boards-query';

function makeCard(id: string, listId: string): Card {
    return {
        id,
        listId,
        title: id.toUpperCase(),
        description: null,
        completedAt: null,
        dueDate: null,
        dueAt: null,
        labelIds: [],
        checklistDone: 0,
        checklistTotal: 0,
        position: 'a0',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

function makeList(id: string, cardIds: Array<string> = []): ListWithCards {
    return {
        id,
        boardId: 'board-1',
        position: 'a0',
        title: `List ${id.toUpperCase()}`,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: cardIds.map((cardId) => makeCard(cardId, id)),
    };
}

function rect(left: number, top: number, width: number, height: number) {
    return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
    } satisfies ClientRect;
}

const lists = [
    makeList('a', ['a1']),
    makeList('b'),
    makeList('c'),
    makeList('d'),
];

// Columns 100 px wide with a 20 px gap and different heights: a tall column
// must not win over a nearer short one.
const rects = new Map<string, ClientRect>([
    ['a', rect(0, 0, 100, 600)],
    ['a1', rect(10, 50, 80, 30)],
    ['b', rect(120, 0, 100, 60)],
    ['c', rect(240, 0, 100, 400)],
    ['d', rect(360, 0, 100, 60)],
]);

const center = (r: ClientRect | undefined) =>
    r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };

describe('isListId', () => {
    it('tells lists from cards', () => {
        expect(isListId(lists, 'a')).toBe(true);
        expect(isListId(lists, 'a1')).toBe(false);
    });
});

describe('listDropIndex', () => {
    it('puts the list at the index of the list it is over', () => {
        expect(listDropIndex(lists, 'a', 'c')).toBe(2);
        expect(listDropIndex(lists, 'd', 'b')).toBe(1);
        expect(listDropIndex(lists, 'b', 'b')).toBe(1);
    });

    it('takes the list of a card it is over', () => {
        expect(listDropIndex(lists, 'c', 'a1')).toBe(0);
    });

    it('is undefined for a card being dragged or an unknown target', () => {
        expect(listDropIndex(lists, 'a1', 'b')).toBeUndefined();
        expect(listDropIndex(lists, 'a', 'missing')).toBeUndefined();
    });
});

describe('pickListDropId', () => {
    it('picks the column with the nearest center by x, whatever its height', () => {
        expect(pickListDropId(lists, rects, { x: 175, y: 500 })).toBe('b');
        expect(pickListDropId(lists, rects, { x: 290, y: 10 })).toBe('c');
    });

    it('picks the first or last column beyond the ends', () => {
        expect(pickListDropId(lists, rects, { x: -500, y: 0 })).toBe('a');
        expect(pickListDropId(lists, rects, { x: 5000, y: 0 })).toBe('d');
    });

    it('picks nothing without measured columns', () => {
        expect(pickListDropId(lists, new Map(), { x: 0, y: 0 })).toBeNull();
    });
});

describe('listKeyboardPoint', () => {
    it('moves right and left to the center of the neighbor column', () => {
        expect(
            listKeyboardPoint(lists, rects, 'b', null, 'ArrowRight'),
        ).toEqual(center(rects.get('c')));
        expect(listKeyboardPoint(lists, rects, 'b', null, 'ArrowLeft')).toEqual(
            center(rects.get('a')),
        );
    });

    it('moves on from where the list is shown, not where it started', () => {
        expect(listKeyboardPoint(lists, rects, 'a', 'c', 'ArrowRight')).toEqual(
            center(rects.get('d')),
        );
    });

    it('does not move past the ends of the board', () => {
        expect(
            listKeyboardPoint(lists, rects, 'a', null, 'ArrowLeft'),
        ).toBeUndefined();
        expect(
            listKeyboardPoint(lists, rects, 'b', 'd', 'ArrowRight'),
        ).toBeUndefined();
    });

    it('ignores up, down and other keys', () => {
        for (const code of ['ArrowUp', 'ArrowDown', 'KeyA']) {
            expect(
                listKeyboardPoint(lists, rects, 'b', null, code),
            ).toBeUndefined();
        }
    });

    it('does nothing on a board with one list', () => {
        const one = [makeList('a')];
        expect(
            listKeyboardPoint(one, rects, 'a', 'a', 'ArrowRight'),
        ).toBeUndefined();
    });
});

describe('listDndAnnouncements', () => {
    const announcements = listDndAnnouncements(lists, { quietOverId: null });
    // The announcement functions read only the ids.
    const active = { id: 'b' } as Active;
    const over = (id: string) => ({ id }) as Over;

    it('announces the pick-up', () => {
        expect(announcements.onDragStart({ active })).toBe(
            'Picked up list List B',
        );
    });

    it('keeps the pick-up: the list over itself right after it is not announced', () => {
        const fresh = listDndAnnouncements(lists, { quietOverId: null });
        fresh.onDragStart({ active });
        expect(fresh.onDragOver({ active, over: over('b') })).toBeUndefined();
        expect(fresh.onDragOver({ active, over: over('c') })).toBe(
            'List List B, position 3 of 4',
        );
    });

    it('announces the position and the drop', () => {
        expect(announcements.onDragOver({ active, over: over('a') })).toBe(
            'List List B, position 1 of 4',
        );
        expect(announcements.onDragEnd({ active, over: over('d') })).toBe(
            'List List B dropped, position 4 of 4',
        );
    });

    it('announces a drop outside the board and a cancel as cancelled', () => {
        expect(announcements.onDragEnd({ active, over: null })).toBe(
            'Moving list List B was cancelled',
        );
        expect(announcements.onDragCancel({ active, over: null })).toBe(
            'Moving list List B was cancelled',
        );
    });
});
