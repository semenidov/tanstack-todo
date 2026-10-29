export interface ChecklistItem {
    id: string;
    checklistId: string;
    title: string;
    done: boolean;
    position: string;
    createdAt: Date;
}

export interface Checklist {
    id: string;
    cardId: string;
    title: string;
    createdAt: Date;
    items: Array<ChecklistItem>;
}

export const MAX_CHECKLIST_TEXT_LENGTH = 500;

export const DEFAULT_CHECKLIST_TITLE = 'Checklist';

export interface ChecklistProgress {
    done: number;
    total: number;
}

export function checklistProgress(
    items: ReadonlyArray<Pick<ChecklistItem, 'done'>>,
): ChecklistProgress {
    return { done: items.filter((i) => i.done).length, total: items.length };
}

export function isChecklistComplete({ done, total }: ChecklistProgress) {
    return total > 0 && done === total;
}

export function addItemToChecklist(
    checklist: Checklist,
    item: ChecklistItem,
): Checklist {
    return { ...checklist, items: [...checklist.items, item] };
}

export function updateItemInChecklist(
    checklist: Checklist,
    itemId: string,
    patch: Partial<Pick<ChecklistItem, 'title' | 'done'>>,
): Checklist {
    return {
        ...checklist,
        items: checklist.items.map((i) =>
            i.id === itemId ? { ...i, ...patch } : i,
        ),
    };
}

export function removeItemFromChecklist(
    checklist: Checklist,
    itemId: string,
): Checklist {
    return {
        ...checklist,
        items: checklist.items.filter((i) => i.id !== itemId),
    };
}

export function moveItemInChecklist(
    checklist: Checklist,
    itemId: string,
    toIndex: number,
): Checklist {
    const item = checklist.items.find((i) => i.id === itemId);
    if (!item) return checklist;
    const items = checklist.items.filter((i) => i.id !== itemId);
    items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, item);
    return { ...checklist, items };
}

export interface ChecklistItemNeighbors {
    prevItemId: string | null;
    nextItemId: string | null;
}

export function checklistItemNeighbors(
    items: ReadonlyArray<Pick<ChecklistItem, 'id'>>,
    itemId: string,
): ChecklistItemNeighbors | undefined {
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) return undefined;
    return {
        prevItemId: index === 0 ? null : (items.at(index - 1)?.id ?? null),
        nextItemId: items.at(index + 1)?.id ?? null,
    };
}
