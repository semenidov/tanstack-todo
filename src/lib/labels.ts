import { labelColorStyle } from '#/lib/label-colors';

export interface Label {
    id: string;
    boardId: string;
    title: string | null;
    color: string;
    createdAt: Date;
}

export const MAX_LABEL_TITLE_LENGTH = 30;

export const LABEL_EXISTS_MESSAGE = 'Label already exists';

/** Untitled labels are null, not '': the unique index skips only nulls. */
export function normalizeLabelTitle(raw: string): string | null {
    const title = raw.trim();
    return title === '' ? null : title;
}

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

export function labelsOfCard(
    labels: ReadonlyArray<Label>,
    labelIds: ReadonlyArray<string>,
): Array<Label> {
    const ids = new Set(labelIds);
    return labels.filter((l) => ids.has(l.id));
}

export function labelName(label: Pick<Label, 'title' | 'color'>): string {
    return label.title ?? `${labelColorStyle(label.color).name} label`;
}

export function filterLabels(labels: ReadonlyArray<Label>, query: string) {
    const q = query.trim().toLowerCase();
    if (q === '') return [...labels];
    return labels.filter((l) => labelName(l).toLowerCase().includes(q));
}
