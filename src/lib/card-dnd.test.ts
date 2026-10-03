import type { Active, ClientRect, Over } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import {
    cardDndAnnouncements,
    cardDropTarget,
    cardKeyboardPoint,
    pickCardDropId,
} from '#/lib/card-dnd';
import type { Card, ListWithCards } from '#/lib/boards-query';

function makeCard(id: string, listId: string): Card {
    return {
        id,
        listId,
        title: id.toUpperCase(),
        description: null,
        position: 'a0',
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

function makeList(id: string, cardIds: Array<string>): ListWithCards {
    return {
        id,
        boardId: 'board-1',
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

// List a: a1, a2, a3; list b: b1; list c: empty.
const lists = [
    makeList('a', ['a1', 'a2', 'a3']),
    makeList('b', ['b1']),
    makeList('c', []),
];

// Columns 100 px wide with a 20 px gap; cards 30 px high with a 10 px gap,
// the first card 50 px below the column top (title and AddCard above it).
const rects = new Map<string, ClientRect>([
    ['a', rect(0, 0, 100, 180)],
    ['a1', rect(10, 50, 80, 30)],
    ['a2', rect(10, 90, 80, 30)],
    ['a3', rect(10, 130, 80, 30)],
    ['b', rect(120, 0, 100, 100)],
    ['b1', rect(130, 50, 80, 30)],
    ['c', rect(240, 0, 100, 60)],
]);

describe('cardDropTarget', () => {
    it('puts the card at the index of a card below it in the same list', () => {
        expect(cardDropTarget(lists, 'a1', 'a3')).toEqual({
            listId: 'a',
            index: 2,
        });
    });

    it('puts the card at the index of a card above it in the same list', () => {
        expect(cardDropTarget(lists, 'a3', 'a1')).toEqual({
            listId: 'a',
            index: 0,
        });
    });

    it('keeps the card in place when it is over itself', () => {
        expect(cardDropTarget(lists, 'a2', 'a2')).toEqual({
            listId: 'a',
            index: 1,
        });
    });

    it('inserts the card before a card of another list', () => {
        expect(cardDropTarget(lists, 'a1', 'b1')).toEqual({
            listId: 'b',
            index: 0,
        });
    });

    it('puts the card at the end of another list over the list itself', () => {
        expect(cardDropTarget(lists, 'a1', 'b')).toEqual({
            listId: 'b',
            index: 1,
        });
    });

    it('puts the card first in an empty list', () => {
        expect(cardDropTarget(lists, 'a1', 'c')).toEqual({
            listId: 'c',
            index: 0,
        });
    });

    it('puts the card last in its own list over the list itself', () => {
        expect(cardDropTarget(lists, 'a1', 'a')).toEqual({
            listId: 'a',
            index: 2,
        });
    });

    it('returns undefined for an unknown card or target', () => {
        expect(cardDropTarget(lists, 'x', 'a')).toBeUndefined();
        expect(cardDropTarget(lists, 'a1', 'x')).toBeUndefined();
    });
});

describe('pickCardDropId', () => {
    it('finds nothing outside the lists', () => {
        expect(pickCardDropId(lists, rects, { x: 110, y: 60 }, false)).toBe(
            null,
        );
        expect(pickCardDropId(lists, rects, { x: 50, y: 400 }, false)).toBe(
            null,
        );
    });

    it('picks the first card over the list title and AddCard', () => {
        expect(pickCardDropId(lists, rects, { x: 50, y: 10 }, false)).toBe(
            'a1',
        );
    });

    it('picks the card with the nearest center', () => {
        expect(pickCardDropId(lists, rects, { x: 50, y: 100 }, false)).toBe(
            'a2',
        );
        expect(pickCardDropId(lists, rects, { x: 50, y: 124 }, false)).toBe(
            'a2',
        );
        expect(pickCardDropId(lists, rects, { x: 50, y: 126 }, false)).toBe(
            'a3',
        );
    });

    it('picks the list below its last card (the end of the list)', () => {
        expect(pickCardDropId(lists, rects, { x: 50, y: 170 }, false)).toBe(
            'a',
        );
    });

    it('picks an empty list', () => {
        expect(pickCardDropId(lists, rects, { x: 290, y: 30 }, false)).toBe(
            'c',
        );
    });

    it('matches a list by x only for the keyboard', () => {
        expect(pickCardDropId(lists, rects, { x: 290, y: 400 }, true)).toBe(
            'c',
        );
    });
});

describe('cardKeyboardPoint', () => {
    it('moves down to the center of the next card', () => {
        expect(
            cardKeyboardPoint(lists, rects, 'a1', null, 'ArrowDown'),
        ).toEqual({ x: 50, y: 105 });
    });

    it('moves on from where the card is shown, not where it started', () => {
        // a1 is shown in place of a2.
        expect(
            cardKeyboardPoint(lists, rects, 'a1', 'a2', 'ArrowDown'),
        ).toEqual({ x: 50, y: 145 });
        expect(cardKeyboardPoint(lists, rects, 'a1', 'a2', 'ArrowUp')).toEqual({
            x: 50,
            y: 65,
        });
    });

    it('does not move past the ends of the list', () => {
        expect(
            cardKeyboardPoint(lists, rects, 'a1', null, 'ArrowUp'),
        ).toBeUndefined();
        expect(
            cardKeyboardPoint(lists, rects, 'a1', 'a3', 'ArrowDown'),
        ).toBeUndefined();
    });

    it('moves to the same position in the next list', () => {
        // Upper part of b1: the card goes before it.
        expect(
            cardKeyboardPoint(lists, rects, 'a1', null, 'ArrowRight'),
        ).toEqual({ x: 170, y: 57.5 });
    });

    it('moves to the end of the next list when it has fewer cards', () => {
        expect(
            cardKeyboardPoint(lists, rects, 'a3', null, 'ArrowRight'),
        ).toEqual({ x: 170, y: 95 });
    });

    it('moves into an empty list', () => {
        expect(
            cardKeyboardPoint(lists, rects, 'b1', null, 'ArrowRight'),
        ).toEqual({ x: 290, y: 30 });
    });

    it('moves to the previous list and not past the first one', () => {
        expect(
            cardKeyboardPoint(lists, rects, 'b1', null, 'ArrowLeft'),
        ).toEqual({ x: 50, y: 57.5 });
        expect(
            cardKeyboardPoint(lists, rects, 'a1', null, 'ArrowLeft'),
        ).toBeUndefined();
    });

    it('ignores other keys', () => {
        expect(
            cardKeyboardPoint(lists, rects, 'a1', null, 'KeyA'),
        ).toBeUndefined();
    });
});

describe('cardDndAnnouncements', () => {
    const announcements = cardDndAnnouncements(lists, { quietOverId: null });
    // The announcement functions read only the ids.
    const active = { id: 'a1' } as Active;
    const over = (id: string) => ({ id }) as Over;

    it('announces the pick-up', () => {
        expect(announcements.onDragStart({ active })).toBe('Picked up card A1');
    });

    it('keeps the pick-up: the card over itself right after it is not announced', () => {
        const fresh = cardDndAnnouncements(lists, { quietOverId: null });
        fresh.onDragStart({ active });

        expect(fresh.onDragOver({ active, over: over('a1') })).toBeUndefined();
        expect(fresh.onDragOver({ active, over: over('a2') })).toBe(
            'Card A1 is in position 2 of 3 in list List A',
        );
        expect(fresh.onDragOver({ active, over: over('a1') })).toBe(
            'Card A1 is in position 1 of 3 in list List A',
        );
    });

    it('announces the position in the same list and in another list', () => {
        expect(announcements.onDragOver({ active, over: over('a3') })).toBe(
            'Card A1 is in position 3 of 3 in list List A',
        );
        expect(announcements.onDragOver({ active, over: over('b1') })).toBe(
            'Card A1 is in position 1 of 2 in list List B',
        );
    });

    it('announces the drop', () => {
        expect(announcements.onDragEnd({ active, over: over('c') })).toBe(
            'Card A1 dropped in position 1 of 1 in list List C',
        );
    });

    it('announces a drop outside the lists and a cancel as cancelled', () => {
        expect(announcements.onDragEnd({ active, over: null })).toBe(
            'Moving card A1 was cancelled',
        );
        expect(announcements.onDragCancel({ active, over: null })).toBe(
            'Moving card A1 was cancelled',
        );
    });
});
