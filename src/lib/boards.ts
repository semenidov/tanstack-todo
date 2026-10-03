import type {
    BoardData,
    BoardSummary,
    Card,
    ListWithCards,
} from '#/lib/boards-query';

// DOM id of a card link on the board, used to return focus after the card dialog closes.
export function cardLinkId(cardId: string): string {
    return `card-${cardId}`;
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

// Undo of a list delete: back to its place, lists are ordered asc(createdAt).
export function restoreListToBoard(
    board: BoardData,
    list: ListWithCards,
): BoardData {
    if (board.lists.some((l) => l.id === list.id)) return board;
    const index = board.lists.findIndex(
        (l) => l.createdAt.getTime() > list.createdAt.getTime(),
    );
    const lists = [...board.lists];
    lists.splice(index === -1 ? lists.length : index, 0, list);
    return { ...board, lists };
}

// New cards sort first: the server gives them a key before the first card.
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
    index: number,
): BoardData {
    const card = findCardInBoard(board, cardId)?.card;
    if (!card || !board.lists.some((l) => l.id === toListId)) return board;

    return {
        ...board,
        lists: board.lists.map((list) => {
            const cards = list.cards.filter((c) => c.id !== cardId);
            if (list.id === toListId) {
                cards.splice(index, 0, { ...card, listId: toListId });
            }
            return { ...list, cards };
        }),
    };
}

export interface CardMoveNeighbors {
    prevCardId: string | null;
    nextCardId: string | null;
}

// The target index counts in the list without the moved card, so the same index
// works for moves down and up inside one list and for moves to another list.
// Move dialog position N is index N - 1; a drop at index i has the card there.
export function cardMoveNeighbors(
    board: BoardData,
    cardId: string,
    toListId: string,
    index: number,
): CardMoveNeighbors | undefined {
    const list = board.lists.find((l) => l.id === toListId);
    if (!list) return undefined;
    const cards = list.cards.filter((c) => c.id !== cardId);
    const at = Math.max(0, Math.min(index, cards.length));
    return {
        // .at(-1) would wrap to the last card, so index 0 has no prev explicitly.
        prevCardId: at === 0 ? null : (cards.at(at - 1)?.id ?? null),
        nextCardId: cards.at(at)?.id ?? null,
    };
}

// Index (in the list without the card) that puts the card between neighbors taken
// earlier, e.g. from the lists a drag showed: cards added since then don't shift it.
// Undefined when the list or both neighbors are gone.
export function cardIndexAfterNeighbors(
    board: BoardData,
    cardId: string,
    toListId: string,
    { prevCardId, nextCardId }: CardMoveNeighbors,
): number | undefined {
    const list = board.lists.find((l) => l.id === toListId);
    if (!list) return undefined;
    if (prevCardId === null) return 0;
    const cards = list.cards.filter((c) => c.id !== cardId);
    const prev = cards.findIndex((c) => c.id === prevCardId);
    if (prev !== -1) return prev + 1;
    const next = cards.findIndex((c) => c.id === nextCardId);
    return next === -1 ? undefined : next;
}

// True when the move would leave the card where it is (no request needed).
export function isSameCardSpot(
    board: BoardData,
    cardId: string,
    toListId: string,
    index: number,
): boolean {
    const found = findCardInBoard(board, cardId);
    if (!found) return true;
    return (
        found.list.id === toListId &&
        found.list.cards.findIndex((c) => c.id === cardId) === index
    );
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

// Card order inside a list, same as the server: position byte-wise (keys are
// ASCII, so JS string comparison matches COLLATE "C"), then id.
export function compareCardOrder(
    a: Pick<Card, 'id' | 'position'>,
    b: Pick<Card, 'id' | 'position'>,
): number {
    if (a.position !== b.position) return a.position < b.position ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
}

// Undo of a card delete: back to its place in its list by position.
// No-op if the list is gone from the board.
export function restoreCardToBoard(board: BoardData, card: Card): BoardData {
    if (findCardInBoard(board, card.id)) return board;
    return {
        ...board,
        lists: board.lists.map((list) => {
            if (list.id !== card.listId) return list;
            const index = list.cards.findIndex(
                (c) => compareCardOrder(c, card) > 0,
            );
            const cards = [...list.cards];
            cards.splice(index === -1 ? cards.length : index, 0, card);
            return { ...list, cards };
        }),
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

export function renameBoardInList(
    boards: BoardSummary[],
    boardId: string,
    title: string,
): BoardSummary[] {
    return boards.map((board) =>
        board.id === boardId ? { ...board, title } : board,
    );
}

export function removeBoardFromList(
    boards: BoardSummary[],
    boardId: string,
): BoardSummary[] {
    return boards.filter((board) => board.id !== boardId);
}
