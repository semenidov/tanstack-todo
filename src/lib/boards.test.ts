import { describe, expect, it } from 'vitest';
import {
    addCardToList,
    addListToBoard,
    createTempId,
    findCardInBoard,
    isTempId,
    moveCardInBoard,
    removeCardFromBoard,
    removeListFromBoard,
    renameListInBoard,
    updateCardInBoard,
} from '#/lib/boards';
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

function makeCard(id: string, title = id): Card {
    return {
        id,
        listId: 'list-1',
        title,
        description: null,
        legacyTodoId: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

function makeList(
    id: string,
    title = id,
    cards: Array<Card> = [],
): ListWithCards {
    return {
        id,
        boardId: 'board-1',
        title,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards,
    };
}

function makeBoard(lists: Array<ListWithCards>): BoardData {
    return {
        board: {
            id: 'board-1',
            ownerId: 'user-1',
            title: 'My tasks',
            createdAt: new Date(0),
            updatedAt: new Date(0),
        },
        lists,
    };
}

describe('addListToBoard', () => {
    it('appends the list to the end', () => {
        const board = makeBoard([makeList('a')]);

        const result = addListToBoard(board, makeList('b'));

        expect(result.lists.map((l) => l.id)).toEqual(['a', 'b']);
    });

    it('does not mutate the original board', () => {
        const board = makeBoard([makeList('a')]);

        addListToBoard(board, makeList('b'));

        expect(board.lists).toHaveLength(1);
    });
});

describe('renameListInBoard', () => {
    it('renames only the matching list', () => {
        const board = makeBoard([makeList('a', 'A'), makeList('b', 'B')]);

        const result = renameListInBoard(board, 'b', 'New');

        expect(result.lists.map((l) => l.title)).toEqual(['A', 'New']);
    });

    it('returns the same titles when the id is missing', () => {
        const board = makeBoard([makeList('a', 'A')]);

        const result = renameListInBoard(board, 'missing', 'New');

        expect(result.lists.map((l) => l.title)).toEqual(['A']);
    });
});

describe('removeListFromBoard', () => {
    it('removes only the matching list', () => {
        const board = makeBoard([makeList('a'), makeList('b')]);

        const result = removeListFromBoard(board, 'a');

        expect(result.lists.map((l) => l.id)).toEqual(['b']);
    });

    it('keeps the lists when the id is missing', () => {
        const board = makeBoard([makeList('a')]);

        expect(removeListFromBoard(board, 'missing').lists).toHaveLength(1);
    });
});

describe('addCardToList', () => {
    it('adds the card to the front of the matching list', () => {
        const board = makeBoard([makeList('a', 'A', [makeCard('c1')])]);

        const result = addCardToList(board, 'a', makeCard('c2'));

        expect(
            result.lists.find((l) => l.id === 'a')?.cards.map((c) => c.id),
        ).toEqual(['c2', 'c1']);
    });
});

describe('updateCardInBoard', () => {
    it('patches only the matching card', () => {
        const board = makeBoard([makeList('a', 'A', [makeCard('c1', 'Old')])]);

        const result = updateCardInBoard(board, 'c1', { title: 'New' });

        expect(result.lists[0]?.cards[0]?.title).toBe('New');
    });
});

describe('moveCardInBoard', () => {
    it('moves the card to the front of the target list', () => {
        const board = makeBoard([
            makeList('a', 'A', [makeCard('c1')]),
            makeList('b', 'B', [makeCard('c2')]),
        ]);

        const result = moveCardInBoard(board, 'c1', 'b');

        expect(result.lists.find((l) => l.id === 'a')?.cards).toHaveLength(0);
        expect(
            result.lists.find((l) => l.id === 'b')?.cards.map((c) => c.id),
        ).toEqual(['c1', 'c2']);
    });

    it('updates the moved card listId', () => {
        const board = makeBoard([
            makeList('a', 'A', [makeCard('c1')]),
            makeList('b', 'B', []),
        ]);

        const result = moveCardInBoard(board, 'c1', 'b');

        expect(result.lists.find((l) => l.id === 'b')?.cards[0]?.listId).toBe(
            'b',
        );
    });

    it('returns the same board when the card is missing', () => {
        const board = makeBoard([makeList('a', 'A', [])]);

        expect(moveCardInBoard(board, 'missing', 'a')).toEqual(board);
    });
});

describe('removeCardFromBoard', () => {
    it('removes only the matching card', () => {
        const board = makeBoard([
            makeList('a', 'A', [makeCard('c1'), makeCard('c2')]),
        ]);

        const result = removeCardFromBoard(board, 'c1');

        expect(result.lists[0]?.cards.map((c) => c.id)).toEqual(['c2']);
    });
});

describe('findCardInBoard', () => {
    it('finds the card and its list', () => {
        const board = makeBoard([makeList('a', 'A', [makeCard('c1')])]);

        const found = findCardInBoard(board, 'c1');

        expect(found?.card.id).toBe('c1');
        expect(found?.list.id).toBe('a');
    });

    it('returns undefined when the card is missing', () => {
        const board = makeBoard([makeList('a', 'A', [])]);

        expect(findCardInBoard(board, 'missing')).toBeUndefined();
    });
});

describe('temp ids', () => {
    it('recognizes ids created by createTempId', () => {
        expect(isTempId(createTempId())).toBe(true);
    });

    it('does not treat a regular uuid as temporary', () => {
        expect(isTempId(crypto.randomUUID())).toBe(false);
    });

    it('creates unique ids', () => {
        expect(createTempId()).not.toBe(createTempId());
    });
});
