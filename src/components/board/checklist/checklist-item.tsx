import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon, XIcon } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { Checkbox } from '#/components/ui/checkbox';
import { Input } from '#/components/ui/input';
import { MAX_CHECKLIST_TEXT_LENGTH } from '#/lib/checklist';
import type { ChecklistItem as Item } from '#/lib/checklist';

/**
 * Marks a field that handles Escape itself (cancels its edit): the card window
 * doesn't close on it (CardDialog checks the attribute).
 */
export const OWN_ESCAPE_ATTRIBUTE = 'data-own-escape';
export const ownEscape = { [OWN_ESCAPE_ATTRIBUTE]: '' };

interface ChecklistItemProps {
    item: Item;
    onToggle: (done: boolean) => void;
    onRename: (title: string) => void;
    onDelete: () => void;
}

// A checklist row: drag handle, check, text (click to edit), ✕ on hover.
export function ChecklistItem({
    item,
    onToggle,
    onRename,
    onDelete,
}: ChecklistItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    function commit(raw: string) {
        const title = raw.trim();
        if (title && title !== item.title) onRename(title);
        setIsEditing(false);
    }

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={
                'group flex min-w-0 items-start gap-1 rounded-md bg-background' +
                (isDragging ? ' relative z-10 shadow-md' : '')
            }
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                aria-label={`Move item ${item.title}`}
                className="flex h-8 w-5 shrink-0 touch-none items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                {...attributes}
                {...listeners}
            >
                <GripVerticalIcon className="size-4" />
            </button>
            <div className="flex h-8 shrink-0 items-center px-1">
                <Checkbox
                    checked={item.done}
                    aria-label={item.title}
                    onCheckedChange={(checked) => onToggle(checked === true)}
                />
            </div>
            <div className="min-w-0 flex-1">
                {isEditing ? (
                    // Mounted anew on every edit: defaultValue is the current text.
                    <Input
                        autoFocus
                        defaultValue={item.title}
                        maxLength={MAX_CHECKLIST_TEXT_LENGTH}
                        aria-label="Item text"
                        {...ownEscape}
                        className="h-auto min-h-8 px-2 py-1.5 text-sm md:text-sm"
                        onBlur={(e) => commit(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                commit(e.currentTarget.value);
                            }
                            if (e.key === 'Escape') setIsEditing(false);
                        }}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="min-h-8 w-full rounded-md border border-transparent px-2 py-1.5 text-left text-sm [overflow-wrap:anywhere] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        {item.title}
                    </button>
                )}
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete item ${item.title}`}
                onClick={onDelete}
                // Shown on hover or focus; always on touch screens (no hover).
                className="size-8 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
                <XIcon />
            </Button>
        </li>
    );
}
