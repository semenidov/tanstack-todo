import type { ReactNode } from 'react';
import { cn } from 'cn';
import { PlusIcon, XIcon } from 'lucide-react';
import {
    DUE_STATUS_CLASSES,
    DueText,
    useDueDescription,
} from '#/components/board/due/due-badge';
import { DueDatePicker } from '#/components/board/due/due-date-picker';
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger,
} from '#/components/responsive-popover';
import { Button } from '#/components/ui/button';
import type { Due } from '#/lib/due-date';

const NO_DUE: Due = { dueDate: null, dueAt: null };

interface DuePopoverProps {
    due: Due;
    onChange: (due: Due) => void;
    // Controlled by the card window: the trigger switches from the "Due date"
    // button to the chip once a day is picked, and the popover stays open.
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function DueDatePopover({
    due,
    onChange,
    open,
    onOpenChange,
    children,
}: DuePopoverProps & { children: ReactNode }) {
    return (
        <ResponsivePopover open={open} onOpenChange={onOpenChange}>
            <ResponsivePopoverTrigger asChild>
                {children}
            </ResponsivePopoverTrigger>
            <ResponsivePopoverContent title="Due date">
                <DueDatePicker due={due} onChange={onChange} />
            </ResponsivePopoverContent>
        </ResponsivePopover>
    );
}

/** The "Due date" button in the row of empty blocks of the card window. */
export function AddDueDateButton(props: DuePopoverProps) {
    return (
        <DueDatePopover {...props}>
            <Button type="button" variant="secondary" size="sm">
                <PlusIcon />
                Due date
            </Button>
        </DueDatePopover>
    );
}

/** The due date block of the card window: a chip opening the picker and ✕. */
export function DueDateField({
    completed,
    ...props
}: DuePopoverProps & { completed: boolean }) {
    const description = useDueDescription(props.due, completed);
    if (!description) return null;
    return (
        <div className="min-w-0">
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                Due date
            </h3>
            <div
                className={cn(
                    'inline-flex h-8 items-center rounded-md bg-secondary text-sm',
                    DUE_STATUS_CLASSES[description.status],
                )}
            >
                <DueDatePopover {...props}>
                    <button
                        type="button"
                        className="flex h-full items-center gap-1.5 rounded-l-md pl-2.5 pr-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <DueText description={description} />
                    </button>
                </DueDatePopover>
                <button
                    type="button"
                    aria-label="Remove due date"
                    onClick={() => props.onChange(NO_DUE)}
                    className="flex h-full items-center rounded-r-md px-1.5 opacity-70 outline-none hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <XIcon className="size-3.5" />
                </button>
            </div>
        </div>
    );
}
