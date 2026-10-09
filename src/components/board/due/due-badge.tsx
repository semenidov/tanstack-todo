import { cn } from 'cn';
import { ClockIcon } from 'lucide-react';
import { DueStatus, describeDue } from '#/lib/due-date';
import type { Due, DueDescription } from '#/lib/due-date';
import { useNow, useTimeZone } from '#/lib/use-time-zone';

// Red - overdue, yellow - today or tomorrow, else neutral (inherits the text color).
export const DUE_STATUS_CLASSES: Record<DueStatus, string> = {
    [DueStatus.Overdue]:
        'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    [DueStatus.Soon]:
        'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
    [DueStatus.Neutral]: '',
};

/** Status and text of the card's due date now, in the render time zone. */
export function useDueDescription(
    due: Due,
    completed: boolean,
): DueDescription | null {
    const timeZone = useTimeZone();
    const now = useNow();
    return describeDue(due, { now, timeZone, completed });
}

/** The text of a due date with its status in words for screen readers. */
export function DueText({ description }: { description: DueDescription }) {
    return (
        <>
            <ClockIcon className="size-3.5 shrink-0" />
            <span className="sr-only">{description.label}: </span>
            <span>{description.text}</span>
        </>
    );
}

/** The due date badge on the card face; nothing without a due date. */
export function DueBadge({ due, completed }: { due: Due; completed: boolean }) {
    const description = useDueDescription(due, completed);
    if (!description) return null;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-sm px-1 py-0.5 whitespace-nowrap',
                DUE_STATUS_CLASSES[description.status],
            )}
        >
            <DueText description={description} />
        </span>
    );
}
