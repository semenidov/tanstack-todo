import { labelColorStyle } from '#/lib/label-colors';

// Labels of a board (#120): pure helpers for the labels cache, the duplicate
// check and the order. The server keeps the same rules (labels-repo.ts).

export interface Label {
    id: string;
    boardId: string;
    /** null - a color-only label. */
    title: string | null;
    color: string;
    createdAt: Date;
}

export const MAX_LABEL_TITLE_LENGTH = 30;

/** The error of a duplicate title, from the form check and from the server. */
export const LABEL_EXISTS_MESSAGE = 'Label already exists';

/**
 * The title as stored: trimmed, an empty one is null. Untitled labels are null,
 * not '': the unique index skips nulls only, so two '' would be duplicates.
 */
export function normalizeLabelTitle(raw: string): string | null {
    const title = raw.trim();
    return title === '' ? null : title;
}

/**
 * True when another label of the board (not `exceptId`) has the title, ignoring
 * case, like the index on lower(title). Untitled labels never clash.
 */
export function isDuplicateLabelTitle(
    labels: ReadonlyArray<Pick<Label, 'id' | 'title'>>,
    title: string | null,
    exceptId?: string,
): boolean {
    if (title === null) return false;
    const key = title.toLowerCase();
    return labels.some(
        (l) => l.id !== exceptId && l.title?.toLowerCase() === key,
    );
}

/** Creation order, as on the server: created_at, then id. */
export function compareLabelOrder(
    a: Pick<Label, 'id' | 'createdAt'>,
    b: Pick<Label, 'id' | 'createdAt'>,
): number {
    const diff = a.createdAt.getTime() - b.createdAt.getTime();
    if (diff !== 0) return diff;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
}

export function addLabelToList(labels: Array<Label>, label: Label) {
    return [...labels.filter((l) => l.id !== label.id), label].sort(
        compareLabelOrder,
    );
}

export function replaceLabelInList(labels: Array<Label>, label: Label) {
    return labels.map((l) => (l.id === label.id ? label : l));
}

export function removeLabelFromList(labels: Array<Label>, labelId: string) {
    return labels.filter((l) => l.id !== labelId);
}

/** The card's labels in the board's label order; unknown ids are skipped. */
export function labelsOfCard(
    labels: ReadonlyArray<Label>,
    labelIds: ReadonlyArray<string>,
): Array<Label> {
    const ids = new Set(labelIds);
    return labels.filter((l) => ids.has(l.id));
}

/** Name for screen readers and search: the title, or the color for an untitled label. */
export function labelName(label: Pick<Label, 'title' | 'color'>): string {
    return label.title ?? `${labelColorStyle(label.color).name} label`;
}

/** Labels whose name contains `query`, ignoring case. */
export function filterLabels(labels: ReadonlyArray<Label>, query: string) {
    const q = query.trim().toLowerCase();
    if (q === '') return [...labels];
    return labels.filter((l) => labelName(l).toLowerCase().includes(q));
}
