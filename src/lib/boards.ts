import type {
    BoardData,
    BoardSummary,
    Card,
    ListWithCards,
} from '#/lib/boards-query';

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

export function compareListOrder(
    a: Pick<ListWithCards, 'id' | 'position'>,
    b: Pick<ListWithCards, 'id' | 'position'>,
): number {
    if (a.position !== b.position) return a.position < b.position ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
}

export function restoreListToBoard(
    board: BoardData,
    list: ListWithCards,
): BoardData {
    if (board.lists.some((l) => l.id === list.id)) return board;
    const index = board.lists.findIndex((l) => compareListOrder(l, list) > 0);
    const lists = [...board.lists];
    lists.splice(index === -1 ? lists.length : index, 0, list);
    return { ...board, lists };
}

export function moveListInBoard(
    board: BoardData,
    listId: string,
    index: number,
): BoardData {
    const list = board.lists.find((l) => l.id === listId);
    if (!list) return board;
    const lists = board.lists.filter((l) => l.id !== listId);
    lists.splice(Math.max(0, Math.min(index, lists.length)), 0, list);
    return { ...board, lists };
}

export interface ListMoveNeighbors {
    prevListId: string | null;
    nextListId: string | null;
}

export function listMoveNeighbors(
    board: BoardData,
    listId: string,
    index: number,
): ListMoveNeighbors {
    const lists = board.lists.filter((l) => l.id !== listId);
    const at = Math.max(0, Math.min(index, lists.length));
    return {
        prevListId: at === 0 ? null : (lists.at(at - 1)?.id ?? null),
        nextListId: lists.at(at)?.id ?? null,
    };
}

export function isSameListSpot(
    board: BoardData,
    listId: string,
    index: number,
): boolean {
    const current = board.lists.findIndex((l) => l.id === listId);
    return current === -1 || current === index;
}

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
    patch: Partial<
        Pick<
            Card,
            'title' | 'description' | 'completedAt' | 'dueDate' | 'dueAt'
        >
    >,
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
        prevCardId: at === 0 ? null : (cards.at(at - 1)?.id ?? null),
        nextCardId: cards.at(at)?.id ?? null,
    };
}

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

export function compareCardOrder(
    a: Pick<Card, 'id' | 'position'>,
    b: Pick<Card, 'id' | 'position'>,
): number {
    if (a.position !== b.position) return a.position < b.position ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
}

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

export function setCardLabelInBoard(
    board: BoardData,
    cardId: string,
    labelId: string,
    on: boolean,
): BoardData {
    return {
        ...board,
        lists: board.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) => {
                if (card.id !== cardId) return card;
                const labelIds = card.labelIds.filter((id) => id !== labelId);
                return {
                    ...card,
                    labelIds: on ? [...labelIds, labelId] : labelIds,
                };
            }),
        })),
    };
}

export function removeLabelFromBoard(
    board: BoardData,
    labelId: string,
): BoardData {
    return {
        ...board,
        lists: board.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) =>
                card.labelIds.includes(labelId)
                    ? {
                          ...card,
                          labelIds: card.labelIds.filter(
                              (id) => id !== labelId,
                          ),
                      }
                    : card,
            ),
        })),
    };
}

export function labelCardCount(board: BoardData, labelId: string): number {
    return board.lists.reduce(
        (n, list) =>
            n + list.cards.filter((c) => c.labelIds.includes(labelId)).length,
        0,
    );
}

export function listLabelLinkCount(list: ListWithCards): number {
    return list.cards.reduce((n, card) => n + card.labelIds.length, 0);
}

export function setChecklistProgressInBoard(
    board: BoardData,
    cardId: string,
    progress: { done: number; total: number },
): BoardData {
    return {
        ...board,
        lists: board.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) =>
                card.id === cardId
                    ? {
                          ...card,
                          checklistDone: progress.done,
                          checklistTotal: progress.total,
                      }
                    : card,
            ),
        })),
    };
}
