import { useMemo, useState } from 'react';
import {
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { Announcements, DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    EllipsisIcon,
    ListChecksIcon,
    LoaderCircleIcon,
    PlusIcon,
    Trash2Icon,
} from 'lucide-react';
import {
    ChecklistItem,
    ownEscape,
} from '#/components/board/checklist/checklist-item';
import {
    useAddChecklistItem,
    useDeleteChecklist,
    useDeleteChecklistItem,
    useMoveChecklistItem,
    useRenameChecklist,
    useUpdateChecklistItem,
} from '#/components/board/checklist/checklist-mutations';
import { DeleteChecklistDialog } from '#/components/board/checklist/delete-checklist-dialog';
import { Button } from '#/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import { Input } from '#/components/ui/input';
import {
    MAX_CHECKLIST_TEXT_LENGTH,
    checklistItemNeighbors,
    checklistProgress,
    isChecklistComplete,
    moveItemInChecklist,
} from '#/lib/checklist';
import type { Checklist } from '#/lib/checklist';

interface ChecklistSectionProps {
    boardId: string;
    cardId: string;
    checklist: Checklist;
    /** Just created: the "Add an item" field opens focused. */
    startAdding: boolean;
}

// The checklist block of the card window (#120): title (edited inline) with
// done/total and ⋯, a progress bar, sortable items, "Add an item".
export function ChecklistSection({
    boardId,
    cardId,
    checklist,
    startAdding,
}: ChecklistSectionProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const renameChecklist = useRenameChecklist(boardId, cardId);
    const deleteChecklist = useDeleteChecklist(boardId, cardId);
    const updateItem = useUpdateChecklistItem(boardId, cardId);
    const deleteItem = useDeleteChecklistItem(boardId, cardId);
    const moveItem = useMoveChecklistItem(boardId, cardId);

    const progress = checklistProgress(checklist.items);
    const percent =
        progress.total === 0
            ? 0
            : Math.round((progress.done / progress.total) * 100);

    function commitTitle(raw: string) {
        const title = raw.trim();
        if (title && title !== checklist.title) {
            renameChecklist.mutate({ checklistId: checklist.id, title });
        }
        setIsEditingTitle(false);
    }

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Screen reader texts by item text, not by id.
    const announcements = useMemo<Announcements>(() => {
        const titleOf = (id: string | number) =>
            checklist.items.find((i) => i.id === id)?.title ?? '';
        const position = (id: string | number) =>
            `position ${checklist.items.findIndex((i) => i.id === id) + 1} of ${checklist.items.length}`;
        return {
            onDragStart: ({ active }) => `Picked up item ${titleOf(active.id)}`,
            onDragOver: ({ active, over }) =>
                over
                    ? `Item ${titleOf(active.id)} is in ${position(over.id)}`
                    : undefined,
            onDragEnd: ({ active, over }) =>
                over
                    ? `Item ${titleOf(active.id)} dropped in ${position(over.id)}`
                    : `Item ${titleOf(active.id)} dropped`,
            onDragCancel: ({ active }) =>
                `Moving item ${titleOf(active.id)} was cancelled`,
        };
    }, [checklist.items]);

    function handleDragEnd({ active, over }: DragEndEvent) {
        if (!over || active.id === over.id) return;
        const itemId = String(active.id);
        const toIndex = checklist.items.findIndex((i) => i.id === over.id);
        if (toIndex === -1) return;
        const moved = moveItemInChecklist(checklist, itemId, toIndex);
        const neighbors = checklistItemNeighbors(moved.items, itemId);
        if (!neighbors) return;
        moveItem.mutate({ itemId, toIndex, ...neighbors });
    }

    return (
        <section aria-label="Checklist" className="min-w-0">
            <div className="flex min-w-0 items-start gap-2">
                <ListChecksIcon className="mt-2 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                    {isEditingTitle ? (
                        <Input
                            autoFocus
                            defaultValue={checklist.title}
                            maxLength={MAX_CHECKLIST_TEXT_LENGTH}
                            aria-label="Checklist title"
                            className="h-auto min-h-8 px-2 py-1.5 text-sm font-medium md:text-sm"
                            {...ownEscape}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={(e) => commitTitle(e.currentTarget.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitTitle(e.currentTarget.value);
                                }
                                if (e.key === 'Escape') {
                                    setIsEditingTitle(false);
                                }
                            }}
                        />
                    ) : (
                        <h3>
                            <button
                                type="button"
                                onClick={() => setIsEditingTitle(true)}
                                className="min-h-8 w-full rounded-md border border-transparent px-2 py-1.5 text-left text-sm font-medium [overflow-wrap:anywhere] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                                {checklist.title}
                            </button>
                        </h3>
                    )}
                </div>
                <span
                    aria-label={`${progress.done} of ${progress.total} items done`}
                    className={
                        'mt-1.5 shrink-0 text-sm tabular-nums ' +
                        (isChecklistComplete(progress)
                            ? 'text-green-600 dark:text-green-500'
                            : 'text-muted-foreground')
                    }
                >
                    {progress.done}/{progress.total}
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Checklist actions"
                            className="size-8 shrink-0"
                        >
                            <EllipsisIcon />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setIsDeleteOpen(true)}
                        >
                            <Trash2Icon />
                            Delete checklist
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div
                role="progressbar"
                aria-label="Checklist progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="mt-2 mb-2 h-1.5 overflow-hidden rounded-full bg-muted"
            >
                <div
                    className={
                        'h-full rounded-full transition-[width] ' +
                        (isChecklistComplete(progress)
                            ? 'bg-green-600 dark:bg-green-500'
                            : 'bg-primary')
                    }
                    style={{ width: `${percent}%` }}
                />
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                accessibility={{ announcements }}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={checklist.items}
                    strategy={verticalListSortingStrategy}
                >
                    <ul aria-label="Checklist items" className="grid gap-0.5">
                        {checklist.items.map((item) => (
                            <ChecklistItem
                                key={item.id}
                                item={item}
                                onToggle={(done) =>
                                    updateItem.mutate({ itemId: item.id, done })
                                }
                                onRename={(title) =>
                                    updateItem.mutate({
                                        itemId: item.id,
                                        title,
                                    })
                                }
                                onDelete={() => deleteItem.mutate(item.id)}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>

            <AddItem
                boardId={boardId}
                cardId={cardId}
                checklistId={checklist.id}
                startAdding={startAdding}
            />

            <DeleteChecklistDialog
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                title={checklist.title}
                itemCount={checklist.items.length}
                onConfirm={() => deleteChecklist.mutate(checklist.id)}
            />
        </section>
    );
}

// "Add an item": Enter saves and keeps the field open for the next one, Esc
// closes it. Not optimistic (ADR 56): the field waits read-only (focus stays)
// and keeps the text on an error.
function AddItem({
    boardId,
    cardId,
    checklistId,
    startAdding,
}: {
    boardId: string;
    cardId: string;
    checklistId: string;
    startAdding: boolean;
}) {
    const [isAdding, setIsAdding] = useState(startAdding);
    const [title, setTitle] = useState('');
    const addItem = useAddChecklistItem(boardId, cardId, checklistId);
    const trimmed = title.trim();

    function submit() {
        if (!trimmed || addItem.isPending) return;
        addItem.mutate(trimmed, { onSuccess: () => setTitle('') });
    }

    if (!isAdding) {
        return (
            <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 ml-6"
                onClick={() => setIsAdding(true)}
            >
                <PlusIcon />
                Add an item
            </Button>
        );
    }

    return (
        <form
            className="mt-2 ml-6 grid gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                submit();
            }}
        >
            <Input
                autoFocus
                value={title}
                placeholder="Add an item"
                aria-label="Add an item"
                maxLength={MAX_CHECKLIST_TEXT_LENGTH}
                readOnly={addItem.isPending}
                aria-busy={addItem.isPending || undefined}
                {...ownEscape}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        setTitle('');
                        setIsAdding(false);
                    }
                }}
            />
            <div className="flex gap-2">
                <Button
                    type="submit"
                    size="sm"
                    disabled={!trimmed || addItem.isPending}
                >
                    {addItem.isPending && (
                        <LoaderCircleIcon className="animate-spin" />
                    )}
                    Add
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setTitle('');
                        setIsAdding(false);
                    }}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}
