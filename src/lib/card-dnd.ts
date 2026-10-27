import type {
    Announcements,
    ClientRect,
    UniqueIdentifier,
} from '@dnd-kit/core';
import type { Coordinates } from '@dnd-kit/utilities';
import type { ListWithCards } from '#/lib/boards-query';

export interface CardSpot {
    listId: string;
    index: number;
}

function findCardSpot(
    lists: Array<ListWithCards>,
    cardId: string,
): { list: ListWithCards; index: number } | undefined {
    for (const list of lists) {
        const index = list.cards.findIndex((c) => c.id === cardId);
        if (index !== -1) return { list, index };
    }
    return undefined;
}

export function cardDropTarget(
    lists: Array<ListWithCards>,
    activeId: string,
    overId: string,
): CardSpot | undefined {
    const from = findCardSpot(lists, activeId);
    if (!from) return undefined;

    const overList = lists.find((l) => l.id === overId);
    if (overList) {
        const others = overList.cards.filter((c) => c.id !== activeId);
        return { listId: overList.id, index: others.length };
    }

    const over = findCardSpot(lists, overId);
    if (!over) return undefined;
    return { listId: over.list.id, index: over.index };
}

function center(rect: ClientRect): Coordinates {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function pickCardDropId(
    lists: Array<ListWithCards>,
    rects: ReadonlyMap<UniqueIdentifier, ClientRect>,
    point: Coordinates,
    byKeyboard: boolean,
): string | null {
    const list = lists.find((l) => {
        const rect = rects.get(l.id);
        if (!rect || point.x < rect.left || point.x > rect.right) return false;
        return byKeyboard || (point.y >= rect.top && point.y <= rect.bottom);
    });
    if (!list) return null;

    const cards = list.cards.flatMap((card) => {
        const rect = rects.get(card.id);
        return rect ? [{ id: card.id, rect }] : [];
    });
    const first = cards.at(0);
    const last = cards.at(-1);
    if (!first || !last || point.y > last.rect.bottom) return list.id;
    if (point.y < first.rect.top) return first.id;

    let nearest = first;
    let nearestDistance = Infinity;
    for (const card of cards) {
        const c = center(card.rect);
        const distance = Math.hypot(c.x - point.x, c.y - point.y);
        if (distance < nearestDistance) {
            nearest = card;
            nearestDistance = distance;
        }
    }
    return nearest.id;
}

export function cardKeyboardPoint(
    lists: Array<ListWithCards>,
    rects: ReadonlyMap<UniqueIdentifier, ClientRect>,
    activeId: string,
    overId: string | null,
    code: string,
): Coordinates | undefined {
    const from = findCardSpot(lists, activeId);
    if (!from) return undefined;
    const current = (overId !== null &&
        cardDropTarget(lists, activeId, overId)) || {
        listId: from.list.id,
        index: from.index,
    };
    const listIndex = lists.findIndex((l) => l.id === current.listId);
    const list = lists.at(listIndex);
    if (listIndex === -1 || !list) return undefined;

    if (code === 'ArrowUp' || code === 'ArrowDown') {
        if (list.id !== from.list.id) return undefined;
        const index = current.index + (code === 'ArrowUp' ? -1 : 1);
        if (index < 0 || index >= list.cards.length) return undefined;
        const rect = rects.get(list.cards[index].id);
        return rect && center(rect);
    }

    if (code === 'ArrowLeft' || code === 'ArrowRight') {
        const nextIndex = listIndex + (code === 'ArrowLeft' ? -1 : 1);
        if (nextIndex < 0) return undefined;
        const next = lists.at(nextIndex);
        if (!next) return undefined;
        const cards = next.cards.filter((c) => c.id !== activeId);
        const target = cards.at(Math.min(current.index, cards.length - 1));
        const rect = target && rects.get(target.id);
        if (!rect) {
            const listRect = rects.get(next.id);
            return listRect && center(listRect);
        }
        const x = rect.left + rect.width / 2;
        return current.index < cards.length
            ? { x, y: rect.top + rect.height / 4 }
            : { x, y: rect.bottom + rect.height / 2 };
    }

    return undefined;
}

export interface CardDndAnnouncerState {
    quietOverId: UniqueIdentifier | null;
}

export function cardDndAnnouncements(
    lists: Array<ListWithCards>,
    state: CardDndAnnouncerState,
): Announcements {
    const title = (id: UniqueIdentifier) =>
        findCardSpot(lists, String(id))?.list.cards.find((c) => c.id === id)
            ?.title ?? '';

    const position = (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
        const spot = cardDropTarget(lists, String(activeId), String(overId));
        const list = spot && lists.find((l) => l.id === spot.listId);
        if (!spot || !list) return undefined;
        const total = list.cards.filter((c) => c.id !== activeId).length + 1;
        return `position ${spot.index + 1} of ${total} in list ${list.title}`;
    };

    const cancelled = (id: UniqueIdentifier) =>
        `Moving card ${title(id)} was cancelled`;

    return {
        onDragStart: ({ active }) => {
            state.quietOverId = active.id;
            return `Picked up card ${title(active.id)}`;
        },
        onDragOver: ({ active, over }) => {
            const quiet = state.quietOverId;
            state.quietOverId = null;
            if (over && over.id === quiet) return undefined;
            const where = over && position(active.id, over.id);
            return where
                ? `Card ${title(active.id)} is in ${where}`
                : `Card ${title(active.id)} is not over a list`;
        },
        onDragEnd: ({ active, over }) => {
            const where = over && position(active.id, over.id);
            return where
                ? `Card ${title(active.id)} dropped in ${where}`
                : cancelled(active.id);
        },
        onDragCancel: ({ active }) => cancelled(active.id),
    };
}
