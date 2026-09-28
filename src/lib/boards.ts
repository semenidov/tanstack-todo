import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';

// Optimistic entities live in the cache only until the server responds;
// their ids must never reach a server function.
const TEMP_ID_PREFIX = 'temp-';

export function createTempId(): string {
    return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

// DOM id of a card link on the board, used to return focus after the card dialog closes.
export function cardLinkId(cardId: string): string {
    return `card-${cardId}`;
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

// New cards sort first (lists.cards is ordered desc(createdAt) server-side).
export function addCardToList(
    board: BoardData,
    listId: string,
    card: Card,
): BoardData {
    return {
        ...board,
        lists: board.lists.map((list) =>
            list.id === listId
                ? { ...list, cards: [card, ...list.cards] }
                : list,
        ),
    };
}

export function updateCardInBoard(
    board: BoardData,
    cardId: string,
    patch: Partial<Pick<Card, 'title' | 'description'>>,
): BoardData {
    return {
        ...board,
        lists: board.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) =>
                card.id === cardId ? { ...card, ...patch } : card,
            ),
        })),
    };
}

export function moveCardInBoard(
    board: BoardData,
    cardId: string,
    toListId: string,
): BoardData {
    const card = findCardInBoard(board, cardId)?.card;
    if (!card) return board;

    return {
        ...board,
        lists: board.lists.map((list) => {
            if (list.id === toListId) {
                return {
                    ...list,
                    cards: [
                        { ...card, listId: toListId },
                        ...list.cards.filter((c) => c.id !== cardId),
                    ],
                };
            }
            return {
                ...list,
                cards: list.cards.filter((c) => c.id !== cardId),
            };
        }),
    };
}

export function removeCardFromBoard(
    board: BoardData,
    cardId: string,
): BoardData {
    return {
        ...board,
        lists: board.lists.map((list) => ({
            ...list,
            cards: list.cards.filter((card) => card.id !== cardId),
        })),
    };
}

export function findCardInBoard(
    board: BoardData,
    cardId: string,
): { card: Card; list: ListWithCards } | undefined {
    for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) return { card, list };
    }
    return undefined;
}
