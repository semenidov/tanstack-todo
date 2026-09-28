import { describe, expect, it } from 'vitest';
import {
    addListToBoard,
    createTempId,
    isTempId,
    removeListFromBoard,
    renameListInBoard,
} from '#/lib/boards';
import type { BoardData, ListWithCards } from '#/lib/boards-query';

function makeList(id: string, title = id): ListWithCards {
    return {
        id,
        boardId: 'board-1',
        title,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        cards: [],
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
