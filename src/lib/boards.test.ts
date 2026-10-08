import { describe, expect, it } from 'vitest';
import {
    addCardToList,
    addListToBoard,
    cardIndexAfterNeighbors,
    cardMoveNeighbors,
    compareListOrder,
    findCardInBoard,
    isSameCardSpot,
    isSameListSpot,
    cardLinkId,
    listMoveNeighbors,
    moveCardInBoard,
    moveListInBoard,
    removeCardFromBoard,
    removeBoardFromList,
    removeListFromBoard,
    renameBoardInList,
    renameListInBoard,
    restoreCardToBoard,
    restoreListToBoard,
    updateCardInBoard,
} from '#/lib/boards';
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

function makeCard(id: string, title = id): Card {
    return {
        id,
        listId: 'list-1',
        title,
        description: null,
        position: 'a0',
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
        position: 'a0',
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

/** Lists a (c1, c2, c3) and b (d1, d2). */
function orderBoard() {
    return makeBoard([
        makeList('a', 'A', [makeCard('c1'), makeCard('c2'), makeCard('c3')]),
        makeList('b', 'B', [makeCard('d1'), makeCard('d2')]),
    ]);
}

/** Card ids per list id. */
function ids(board: BoardData) {
    return Object.fromEntries(
        board.lists.map((l) => [l.id, l.cards.map((c) => c.id)]),
    );
}

describe('moveCardInBoard', () => {
    it('moves a card down inside its list to exactly the given index', () => {
        const result = moveCardInBoard(orderBoard(), 'c1', 'a', 2);

        expect(ids(result).a).toEqual(['c2', 'c3', 'c1']);
    });

    it('moves a card up inside its list to exactly the given index', () => {
        const result = moveCardInBoard(orderBoard(), 'c3', 'a', 1);

        expect(ids(result).a).toEqual(['c1', 'c3', 'c2']);
    });

    it('moves a card to another list at the given index', () => {
        const result = moveCardInBoard(orderBoard(), 'c2', 'b', 1);

        expect(ids(result)).toEqual({ a: ['c1', 'c3'], b: ['d1', 'c2', 'd2'] });
    });

    it('moves a card to the start and the end of another list', () => {
        expect(ids(moveCardInBoard(orderBoard(), 'c1', 'b', 0)).b).toEqual([
            'c1',
            'd1',
            'd2',
        ]);
        expect(ids(moveCardInBoard(orderBoard(), 'c1', 'b', 2)).b).toEqual([
            'd1',
            'd2',
            'c1',
        ]);
    });

    it('clamps an index past the end to the end', () => {
        expect(ids(moveCardInBoard(orderBoard(), 'c1', 'b', 9)).b).toEqual([
            'd1',
            'd2',
            'c1',
        ]);
    });

    it('moves a card into an empty list', () => {
        const board = makeBoard([
            makeList('a', 'A', [makeCard('c1')]),
            makeList('b', 'B', []),
        ]);

        expect(ids(moveCardInBoard(board, 'c1', 'b', 0))).toEqual({
            a: [],
            b: ['c1'],
        });
    });

    it('updates the moved card listId', () => {
        const result = moveCardInBoard(orderBoard(), 'c1', 'b', 0);

        expect(result.lists[1].cards[0].listId).toBe('b');
    });

    it('returns the same board when the card or the list is missing', () => {
        const board = orderBoard();

        expect(moveCardInBoard(board, 'missing', 'a', 0)).toBe(board);
        expect(moveCardInBoard(board, 'c1', 'missing', 0)).toBe(board);
    });
});

describe('cardMoveNeighbors', () => {
    it('takes the neighbors from the list without the card when moving down', () => {
        expect(cardMoveNeighbors(orderBoard(), 'c1', 'a', 1)).toEqual({
            prevCardId: 'c2',
            nextCardId: 'c3',
        });
        expect(cardMoveNeighbors(orderBoard(), 'c1', 'a', 2)).toEqual({
            prevCardId: 'c3',
            nextCardId: null,
        });
    });

    it('takes the neighbors from the list without the card when moving up', () => {
        expect(cardMoveNeighbors(orderBoard(), 'c3', 'a', 0)).toEqual({
            prevCardId: null,
            nextCardId: 'c1',
        });
        expect(cardMoveNeighbors(orderBoard(), 'c3', 'a', 1)).toEqual({
            prevCardId: 'c1',
            nextCardId: 'c2',
        });
    });

    it('takes the neighbors in another list, including the edges', () => {
        expect(cardMoveNeighbors(orderBoard(), 'c1', 'b', 0)).toEqual({
            prevCardId: null,
            nextCardId: 'd1',
        });
        expect(cardMoveNeighbors(orderBoard(), 'c1', 'b', 1)).toEqual({
            prevCardId: 'd1',
            nextCardId: 'd2',
        });
        expect(cardMoveNeighbors(orderBoard(), 'c1', 'b', 2)).toEqual({
            prevCardId: 'd2',
            nextCardId: null,
        });
    });

    it('has no neighbors in an empty list', () => {
        const board = makeBoard([
            makeList('a', 'A', [makeCard('c1')]),
            makeList('b', 'B', []),
        ]);

        expect(cardMoveNeighbors(board, 'c1', 'b', 0)).toEqual({
            prevCardId: null,
            nextCardId: null,
        });
    });

    it('returns undefined when the target list is missing', () => {
        expect(
            cardMoveNeighbors(orderBoard(), 'c1', 'missing', 0),
        ).toBeUndefined();
    });
});

describe('cardIndexAfterNeighbors', () => {
    it('puts the card right after its prev neighbor, wherever it is now', () => {
        // A new card n0 came on top after the neighbors were taken.
        const board = makeBoard([
            makeList('a', 'A', [
                makeCard('n0'),
                makeCard('c1'),
                makeCard('c2'),
                makeCard('c3'),
            ]),
        ]);

        expect(
            cardIndexAfterNeighbors(board, 'c3', 'a', {
                prevCardId: 'c1',
                nextCardId: 'c2',
            }),
        ).toBe(2);
    });

    it('puts the card first without a prev neighbor', () => {
        expect(
            cardIndexAfterNeighbors(orderBoard(), 'c3', 'a', {
                prevCardId: null,
                nextCardId: 'c1',
            }),
        ).toBe(0);
    });

    it('falls back to the next neighbor when the prev one is gone', () => {
        expect(
            cardIndexAfterNeighbors(orderBoard(), 'c1', 'b', {
                prevCardId: 'gone',
                nextCardId: 'd2',
            }),
        ).toBe(1);
    });

    it('returns undefined when no neighbor is found or the list is missing', () => {
        expect(
            cardIndexAfterNeighbors(orderBoard(), 'c1', 'b', {
                prevCardId: 'gone',
                nextCardId: null,
            }),
        ).toBeUndefined();
        expect(
            cardIndexAfterNeighbors(orderBoard(), 'c1', 'x', {
                prevCardId: null,
                nextCardId: null,
            }),
        ).toBeUndefined();
    });
});

describe('isSameCardSpot', () => {
    it('is true for the current index in the current list', () => {
        expect(isSameCardSpot(orderBoard(), 'c2', 'a', 1)).toBe(true);
    });

    it('is false for another index or another list', () => {
        expect(isSameCardSpot(orderBoard(), 'c2', 'a', 0)).toBe(false);
        expect(isSameCardSpot(orderBoard(), 'c2', 'a', 2)).toBe(false);
        expect(isSameCardSpot(orderBoard(), 'c2', 'b', 1)).toBe(false);
    });

    it('is true for a missing card: there is nothing to move', () => {
        expect(isSameCardSpot(orderBoard(), 'missing', 'a', 0)).toBe(true);
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

describe('cardLinkId', () => {
    it('builds a stable DOM id from the card id', () => {
        expect(cardLinkId('abc')).toBe('card-abc');
    });
});

describe('boards list cache', () => {
    const boards = [
        { id: 'a', title: 'A', listCount: 2, cardCount: 0 },
        { id: 'b', title: 'B', listCount: 1, cardCount: 3 },
    ];

    it('renames only the target board without mutating the input', () => {
        const next = renameBoardInList(boards, 'b', 'Renamed');
        expect(next.map((b) => b.title)).toEqual(['A', 'Renamed']);
        expect(boards[1].title).toBe('B');
    });

    it('removes only the target board, keeping the original snapshot for rollback', () => {
        const next = removeBoardFromList(boards, 'a');
        expect(next.map((b) => b.id)).toEqual(['b']);
        expect(boards).toHaveLength(2);
    });
});

function at<T extends { position: string }>(item: T, position: string): T {
    return { ...item, position };
}

describe('restoreListToBoard', () => {
    it('puts the list back by position, compared byte-wise', () => {
        const board = makeBoard([
            at(makeList('a'), 'Zz'),
            at(makeList('c'), 'a1'),
        ]);
        const next = restoreListToBoard(board, at(makeList('b'), 'a0'));
        expect(next.lists.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    });

    it('puts the list back at its key after other lists moved', () => {
        // Created first, but its key is now after the others.
        const board = makeBoard([
            at(makeList('a'), 'a0'),
            at(makeList('c'), 'a2'),
        ]);
        const next = restoreListToBoard(board, {
            ...at(makeList('b'), 'a1'),
            createdAt: new Date(-1),
        });
        expect(next.lists.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    });

    it('puts the last list at the end and the first at the start', () => {
        const board = makeBoard([at(makeList('b'), 'a1')]);
        const withLast = restoreListToBoard(board, at(makeList('c'), 'a2'));
        const withFirst = restoreListToBoard(board, at(makeList('a'), 'a0'));
        expect(withLast.lists.map((l) => l.id)).toEqual(['b', 'c']);
        expect(withFirst.lists.map((l) => l.id)).toEqual(['a', 'b']);
    });

    it('keeps the cards of the restored list', () => {
        const list = makeList('a', 'a', [makeCard('x')]);
        const next = restoreListToBoard(makeBoard([]), list);
        expect(next.lists[0].cards.map((c) => c.id)).toEqual(['x']);
    });

    it('does nothing if the list is already on the board', () => {
        const board = makeBoard([makeList('a')]);
        expect(restoreListToBoard(board, makeList('a'))).toBe(board);
    });
});

function placed(card: Card, position: string): Card {
    return { ...card, position };
}

describe('restoreCardToBoard', () => {
    it('puts the card back by position, compared byte-wise', () => {
        const board = makeBoard([
            makeList('list-1', 'List', [
                placed(makeCard('a'), 'Zz'),
                placed(makeCard('c'), 'a1'),
            ]),
        ]);
        const next = restoreCardToBoard(board, placed(makeCard('b'), 'a0'));
        expect(next.lists[0].cards.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('puts the card first or last by position', () => {
        const board = makeBoard([
            makeList('list-1', 'List', [placed(makeCard('b'), 'a1')]),
        ]);
        const first = restoreCardToBoard(board, placed(makeCard('a'), 'a0'));
        const last = restoreCardToBoard(board, placed(makeCard('c'), 'a2'));
        expect(first.lists[0].cards.map((c) => c.id)).toEqual(['a', 'b']);
        expect(last.lists[0].cards.map((c) => c.id)).toEqual(['b', 'c']);
    });

    it('breaks a position tie by id, like the server', () => {
        const board = makeBoard([
            makeList('list-1', 'List', [
                placed(makeCard('a'), 'a1'),
                placed(makeCard('c'), 'a1'),
            ]),
        ]);
        const next = restoreCardToBoard(board, placed(makeCard('b'), 'a1'));
        expect(next.lists[0].cards.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('does nothing if the list is gone', () => {
        const board = makeBoard([makeList('list-2')]);
        const next = restoreCardToBoard(board, makeCard('a'));
        expect(next.lists[0].cards).toEqual([]);
    });

    it('does nothing if the card is already on the board', () => {
        const board = makeBoard([makeList('list-1', 'List', [makeCard('a')])]);
        expect(restoreCardToBoard(board, makeCard('a'))).toBe(board);
    });
});

describe('compareListOrder', () => {
    it('orders by position byte-wise, then by id', () => {
        const lists = [
            at(makeList('b'), 'a0'),
            at(makeList('c'), 'Zz'),
            at(makeList('a'), 'a0'),
        ];
        expect(lists.sort(compareListOrder).map((l) => l.id)).toEqual([
            'c',
            'a',
            'b',
        ]);
    });
});

describe('moveListInBoard', () => {
    const board = makeBoard([makeList('a'), makeList('b'), makeList('c')]);
    const listIds = (b: BoardData) => b.lists.map((l) => l.id);

    it('moves a list right and left by the index without it', () => {
        expect(listIds(moveListInBoard(board, 'a', 2))).toEqual([
            'b',
            'c',
            'a',
        ]);
        expect(listIds(moveListInBoard(board, 'c', 0))).toEqual([
            'c',
            'a',
            'b',
        ]);
        expect(listIds(moveListInBoard(board, 'a', 1))).toEqual([
            'b',
            'a',
            'c',
        ]);
    });

    it('keeps the cards of the moved list', () => {
        const withCards = makeBoard([
            makeList('a', 'a', [makeCard('x')]),
            makeList('b'),
        ]);
        const next = moveListInBoard(withCards, 'a', 1);
        expect(next.lists[1].cards.map((c) => c.id)).toEqual(['x']);
    });

    it('returns the board as is for an unknown list', () => {
        expect(moveListInBoard(board, 'missing', 0)).toBe(board);
    });
});

describe('listMoveNeighbors', () => {
    const board = makeBoard([makeList('a'), makeList('b'), makeList('c')]);

    it('gives the lists around the index, counted without the moved list', () => {
        expect(listMoveNeighbors(board, 'a', 0)).toEqual({
            prevListId: null,
            nextListId: 'b',
        });
        expect(listMoveNeighbors(board, 'a', 1)).toEqual({
            prevListId: 'b',
            nextListId: 'c',
        });
        expect(listMoveNeighbors(board, 'a', 2)).toEqual({
            prevListId: 'c',
            nextListId: null,
        });
    });

    it('gives neighbors on another board, where the list is not yet', () => {
        expect(listMoveNeighbors(board, 'other', 0)).toEqual({
            prevListId: null,
            nextListId: 'a',
        });
        expect(listMoveNeighbors(board, 'other', 3)).toEqual({
            prevListId: 'c',
            nextListId: null,
        });
    });

    it('gives no neighbors on an empty board', () => {
        expect(listMoveNeighbors(makeBoard([]), 'other', 0)).toEqual({
            prevListId: null,
            nextListId: null,
        });
    });
});

describe('isSameListSpot', () => {
    const board = makeBoard([makeList('a'), makeList('b')]);

    it('is true for the current index and false for another', () => {
        expect(isSameListSpot(board, 'a', 0)).toBe(true);
        expect(isSameListSpot(board, 'a', 1)).toBe(false);
        expect(isSameListSpot(board, 'b', 1)).toBe(true);
    });

    it('is true for a list not on the board: nothing to move', () => {
        expect(isSameListSpot(board, 'missing', 0)).toBe(true);
    });
});
