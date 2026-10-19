import type { ComponentProps } from 'react';
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
} from '#/components/responsive-popover';
import type { PopoverButtonProps } from '#/components/responsive-popover';
import { Button } from '#/components/ui/button';
import type { Due } from '#/lib/due-date';

const NO_DUE: Due = { dueDate: null, dueAt: null };

interface DueDatePopoverProps extends Omit<
    ComponentProps<typeof ResponsivePopover>,
    'children'
> {
    due: Due;
    onChange: (due: Due) => void;
    onOpenChange: (open: boolean) => void;
}

// Rendered by the card window apart from the "Due date" button and the chip,
// which only toggle it: picking the first day swaps them, the popover stays
// open and in place (#133).
export function DueDatePopover({
    due,
    onChange,
    ...props
}: DueDatePopoverProps) {
    return (
        <ResponsivePopover {...props}>
            <ResponsivePopoverContent title="Due date">
                <DueDatePicker
                    due={due}
                    onChange={onChange}
                    onClose={() => props.onOpenChange(false)}
                />
            </ResponsivePopoverContent>
        </ResponsivePopover>
    );
}

/** The "Due date" button in the row of empty blocks of the card window. */
export function AddDueDateButton({
    buttonProps,
}: {
    buttonProps: PopoverButtonProps;
}) {
    return (
        <Button type="button" variant="secondary" size="sm" {...buttonProps}>
            <PlusIcon />
            Due date
        </Button>
    );
}

/** The due date block of the card window: a chip opening the picker and ✕. */
export function DueDateField({
    due,
    onChange,
    completed,
    buttonProps,
}: {
    due: Due;
    onChange: (due: Due) => void;
    completed: boolean;
    buttonProps: PopoverButtonProps;
}) {
    const description = useDueDescription(due, completed);
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
                <button
                    type="button"
                    className="flex h-full items-center gap-1.5 rounded-l-md pl-2.5 pr-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    {...buttonProps}
                >
                    <DueText description={description} />
                </button>
                <button
                    type="button"
                    aria-label="Remove due date"
                    onClick={() => onChange(NO_DUE)}
                    className="flex h-full items-center rounded-r-md px-1.5 opacity-70 outline-none hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <XIcon className="size-3.5" />
                </button>
            </div>
        </div>
    );
}
