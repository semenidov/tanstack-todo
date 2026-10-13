import { useId, useState } from 'react';
import { LoaderCircleIcon, PlusIcon } from 'lucide-react';
import { useCreateChecklist } from '#/components/board/checklist/checklist-mutations';
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger,
} from '#/components/responsive-popover';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import {
    DEFAULT_CHECKLIST_TITLE,
    MAX_CHECKLIST_TEXT_LENGTH,
} from '#/lib/checklist';

interface AddChecklistPopoverProps {
    boardId: string;
    cardId: string;
    /** After the checklist is saved: the window focuses its "Add an item" field. */
    onCreated: () => void;
}

/** The "Checklist" button in the row of empty blocks and its popover. */
export function AddChecklistPopover({
    boardId,
    cardId,
    onCreated,
}: AddChecklistPopoverProps) {
    const [open, setOpen] = useState(false);

    return (
        <ResponsivePopover open={open} onOpenChange={setOpen}>
            <ResponsivePopoverTrigger asChild>
                <Button type="button" variant="secondary" size="sm">
                    <PlusIcon />
                    Checklist
                </Button>
            </ResponsivePopoverTrigger>
            <ResponsivePopoverContent title="Add checklist">
                {/* Mounted on open: the title starts from the default each time. */}
                <AddChecklistForm
                    boardId={boardId}
                    cardId={cardId}
                    onCreated={() => {
                        setOpen(false);
                        onCreated();
                    }}
                />
            </ResponsivePopoverContent>
        </ResponsivePopover>
    );
}

function AddChecklistForm({
    boardId,
    cardId,
    onCreated,
}: AddChecklistPopoverProps) {
    const id = useId();
    const [title, setTitle] = useState(DEFAULT_CHECKLIST_TITLE);
    const createChecklist = useCreateChecklist(boardId, cardId);
    const trimmed = title.trim();

    return (
        <form
            className="grid gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (!trimmed || createChecklist.isPending) return;
                // Not optimistic (ADR 56): the form waits, an error keeps the text.
                createChecklist.mutate(trimmed, { onSuccess: onCreated });
            }}
        >
            <div className="grid gap-1.5">
                <Label htmlFor={`${id}-title`}>Title</Label>
                <Input
                    id={`${id}-title`}
                    autoFocus
                    value={title}
                    maxLength={MAX_CHECKLIST_TEXT_LENGTH}
                    readOnly={createChecklist.isPending}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </div>
            <Button
                type="submit"
                disabled={!trimmed || createChecklist.isPending}
            >
                {createChecklist.isPending && (
                    <LoaderCircleIcon className="animate-spin" />
                )}
                Add
            </Button>
        </form>
    );
}
