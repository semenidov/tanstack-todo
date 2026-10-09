import { describe, expect, it } from 'vitest';
import {
    addItemToChecklist,
    checklistItemNeighbors,
    checklistProgress,
    isChecklistComplete,
    moveItemInChecklist,
    removeItemFromChecklist,
    updateItemInChecklist,
} from '#/lib/checklist';
import type { Checklist, ChecklistItem } from '#/lib/checklist';

function item(id: string, done = false): ChecklistItem {
    return {
        id,
        checklistId: 'checklist-1',
        title: `Item ${id}`,
        done,
        position: id,
        createdAt: new Date(0),
    };
}

function checklist(...items: Array<ChecklistItem>): Checklist {
    return {
        id: 'checklist-1',
        cardId: 'card-1',
        title: 'Checklist',
        createdAt: new Date(0),
        items,
    };
}

const ids = (c: Checklist) => c.items.map((i) => i.id);

describe('checklistProgress', () => {
    it.each([
        { items: [], done: 0, total: 0, complete: false },
        {
            items: [
                item('a', true),
                item('b', true),
                item('c'),
                item('d'),
                item('e'),
            ],
            done: 2,
            total: 5,
            complete: false,
        },
        {
            items: [item('a', true), item('b', true)],
            done: 2,
            total: 2,
            complete: true,
        },
    ])(
        '$done/$total, complete: $complete',
        ({ items, done, total, complete }) => {
            const progress = checklistProgress(items);
            expect(progress).toEqual({ done, total });
            expect(isChecklistComplete(progress)).toBe(complete);
        },
    );
});

describe('checklist cache edits', () => {
    it('adds an item last', () => {
        expect(
            ids(addItemToChecklist(checklist(item('a')), item('b'))),
        ).toEqual(['a', 'b']);
    });

    it('updates the title and the check of one item', () => {
        const next = updateItemInChecklist(
            checklist(item('a'), item('b')),
            'b',
            { title: 'Renamed', done: true },
        );
        expect(next.items[0]).toEqual(item('a'));
        expect(next.items[1]).toMatchObject({ title: 'Renamed', done: true });
    });

    it('removes an item', () => {
        expect(
            ids(removeItemFromChecklist(checklist(item('a'), item('b')), 'a')),
        ).toEqual(['b']);
    });
});

describe('moving an item', () => {
    const list = checklist(item('a'), item('b'), item('c'), item('d'));

    it.each([
        { id: 'a', to: 2, order: ['b', 'c', 'a', 'd'] },
        { id: 'd', to: 0, order: ['d', 'a', 'b', 'c'] },
        { id: 'b', to: 99, order: ['a', 'c', 'd', 'b'] },
        { id: 'c', to: 2, order: ['a', 'b', 'c', 'd'] },
        { id: 'missing', to: 0, order: ['a', 'b', 'c', 'd'] },
    ])('$id to index $to', ({ id, to, order }) => {
        expect(ids(moveItemInChecklist(list, id, to))).toEqual(order);
    });

    it.each([
        { id: 'a', prevItemId: null, nextItemId: 'b' },
        { id: 'b', prevItemId: 'a', nextItemId: 'c' },
        { id: 'd', prevItemId: 'c', nextItemId: null },
    ])(
        'neighbors of $id: $prevItemId and $nextItemId',
        ({ id, prevItemId, nextItemId }) => {
            expect(checklistItemNeighbors(list.items, id)).toEqual({
                prevItemId,
                nextItemId,
            });
        },
    );

    it('a single item has no neighbors; a missing one - no answer', () => {
        expect(checklistItemNeighbors([item('a')], 'a')).toEqual({
            prevItemId: null,
            nextItemId: null,
        });
        expect(checklistItemNeighbors(list.items, 'missing')).toBeUndefined();
    });

    it('the neighbors after a move are the items around the new spot', () => {
        const moved = moveItemInChecklist(list, 'a', 2);
        expect(checklistItemNeighbors(moved.items, 'a')).toEqual({
            prevItemId: 'c',
            nextItemId: 'd',
        });
    });
});
