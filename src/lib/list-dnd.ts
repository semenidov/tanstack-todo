import type {
    Announcements,
    ClientRect,
    UniqueIdentifier,
} from '@dnd-kit/core';
import type { Coordinates } from '@dnd-kit/utilities';
import type { ListWithCards } from '#/lib/boards-query';

export function isListId(
    lists: Array<ListWithCards>,
    id: UniqueIdentifier,
): boolean {
    return lists.some((l) => l.id === id);
}

export function listDropIndex(
    lists: Array<ListWithCards>,
    activeId: string,
    overId: string,
): number | undefined {
    if (!isListId(lists, activeId)) return undefined;
    const index = lists.findIndex(
        (l) => l.id === overId || l.cards.some((c) => c.id === overId),
    );
    return index === -1 ? undefined : index;
}

function center(rect: ClientRect): Coordinates {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function pickListDropId(
    lists: Array<ListWithCards>,
    rects: ReadonlyMap<UniqueIdentifier, ClientRect>,
    point: Coordinates,
): string | null {
    let nearest: string | null = null;
    let nearestDistance = Infinity;
    for (const list of lists) {
        const rect = rects.get(list.id);
        if (!rect) continue;
        const distance = Math.abs(center(rect).x - point.x);
        if (distance < nearestDistance) {
            nearest = list.id;
            nearestDistance = distance;
        }
    }
    return nearest;
}

export function listKeyboardPoint(
    lists: Array<ListWithCards>,
    rects: ReadonlyMap<UniqueIdentifier, ClientRect>,
    activeId: string,
    overId: string | null,
    code: string,
): Coordinates | undefined {
    if (code !== 'ArrowLeft' && code !== 'ArrowRight') return undefined;
    const shown =
        overId === null ? undefined : listDropIndex(lists, activeId, overId);
    const current = shown ?? lists.findIndex((l) => l.id === activeId);
    if (current === -1) return undefined;
    const next = current + (code === 'ArrowLeft' ? -1 : 1);
    if (next < 0) return undefined;
    const target = lists.at(next);
    const rect = target && rects.get(target.id);
    return rect && center(rect);
}

export interface ListDndAnnouncerState {
    quietOverId: UniqueIdentifier | null;
}

export function listDndAnnouncements(
    lists: Array<ListWithCards>,
    state: ListDndAnnouncerState,
): Announcements {
    const title = (id: UniqueIdentifier) =>
        lists.find((l) => l.id === id)?.title ?? '';

    const position = (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
        const index = listDropIndex(lists, String(activeId), String(overId));
        return index === undefined
            ? undefined
            : `position ${index + 1} of ${lists.length}`;
    };

    const cancelled = (id: UniqueIdentifier) =>
        `Moving list ${title(id)} was cancelled`;

    return {
        onDragStart: ({ active }) => {
            state.quietOverId = active.id;
            return `Picked up list ${title(active.id)}`;
        },
        onDragOver: ({ active, over }) => {
            const quiet = state.quietOverId;
            state.quietOverId = null;
            if (over && over.id === quiet) return undefined;
            const where = over && position(active.id, over.id);
            return where
                ? `List ${title(active.id)}, ${where}`
                : `List ${title(active.id)} is not over the board`;
        },
        onDragEnd: ({ active, over }) => {
            const where = over && position(active.id, over.id);
            return where
                ? `List ${title(active.id)} dropped, ${where}`
                : cancelled(active.id);
        },
        onDragCancel: ({ active }) => cancelled(active.id),
    };
}
