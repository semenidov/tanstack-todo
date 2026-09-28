import type { BoardData, ListWithCards } from '#/lib/boards-query';

// Optimistic entities live in the cache only until the server responds;
// their ids must never reach a server function.
const TEMP_ID_PREFIX = 'temp-';

export function createTempId(): string {
    return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isTempId(id: string): boolean {
    return id.startsWith(TEMP_ID_PREFIX);
}

export function addListToBoard(
    board: BoardData,
    list: ListWithCards,
): BoardData {
    return { ...board, lists: [...board.lists, list] };
}

export function renameListInBoard(
    board: BoardData,
    listId: string,
    title: string,
): BoardData {
    return {
        ...board,
        lists: board.lists.map((list) =>
            list.id === listId ? { ...list, title } : list,
        ),
    };
}

export function removeListFromBoard(
    board: BoardData,
    listId: string,
): BoardData {
    return {
        ...board,
        lists: board.lists.filter((list) => list.id !== listId),
    };
}
