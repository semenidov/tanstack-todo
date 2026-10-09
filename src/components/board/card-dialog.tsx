import { useState } from 'react';
import {
    useDeleteCard,
    useMoveCard,
    useUpdateCard,
} from '#/components/board/card-mutations';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
} from '#/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { ListSelect } from '#/components/board/list-select';
import { Textarea } from '#/components/ui/textarea';
import type { Card, ListWithCards } from '#/lib/boards-query';
import { useHydrated } from '#/lib/use-hydrated';
import {
    CircleCheckIcon,
    CircleIcon,
    EllipsisIcon,
    TextIcon,
    Trash2Icon,
    XIcon,
} from 'lucide-react';

interface CardDialogProps {
    boardId: string;
    card: Card;
    list: ListWithCards;
    lists: Array<ListWithCards>;
    onClose: () => Promise<void> | void;
}

export function CardDialog({
    boardId,
    card,
    list,
    lists,
    onClose,
}: CardDialogProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [description, setDescription] = useState(card.description ?? '');
    const updateCard = useUpdateCard(boardId, card.id);
    const { moveCard } = useMoveCard(boardId);
    const { deleteWithUndo } = useDeleteCard(boardId);
    const isCompleted = card.completedAt !== null;

    function commitTitle(raw: string) {
        const trimmed = raw.trim();
        if (trimmed && trimmed !== card.title) {
            updateCard.mutate({ title: trimmed });
        }
        setIsEditingTitle(false);
    }

    function saveDescription() {
        const trimmed = description.trim();
        if (trimmed !== (card.description ?? '')) {
            updateCard.mutate({
                description: trimmed === '' ? null : trimmed,
            });
        }
    }

    function cancelDescription() {
        setDescription(card.description ?? '');
    }

    async function handleDelete() {
        // Leave the card route first: removing the card from the cache while
        // the route is still mounted triggers its "Card not found" fallback.
        await onClose();
        void deleteWithUndo(card);
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) void onClose();
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
            >
                {/* Header: completed toggle → title and its list → menu and close. */}
                <div className="flex min-w-0 items-start gap-2">
                    {/* The only place to mark the card completed. */}
                    <button
                        type="button"
                        role="checkbox"
                        aria-checked={isCompleted}
                        aria-label="Completed"
                        onClick={() =>
                            updateCard.mutate({ completed: !isCompleted })
                        }
                        className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        {isCompleted ? (
                            <CircleCheckIcon className="size-5 text-green-600 dark:text-green-500" />
                        ) : (
                            <CircleIcon className="size-5 text-muted-foreground" />
                        )}
                    </button>

                    {/* min-w-0: long titles and list names wrap or truncate
                        instead of widening the dialog. */}
                    <div className="min-w-0 flex-1">
                        {isEditingTitle ? (
                            <>
                                {/* Keeps the dialog named for screen readers while the title is an input. */}
                                <DialogTitle className="sr-only">
                                    {card.title}
                                </DialogTitle>
                                {/* Mounted anew on every edit, so defaultValue always starts from the current title. */}
                                <Input
                                    autoFocus
                                    defaultValue={card.title}
                                    aria-label="Card title"
                                    className="h-9 border-none bg-transparent px-0 py-0 text-lg leading-none font-semibold shadow-none"
                                    onFocus={(e) => e.currentTarget.select()}
                                    onBlur={(e) =>
                                        commitTitle(e.currentTarget.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            commitTitle(e.currentTarget.value);
                                        }
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                />
                            </>
                        ) : (
                            <DialogTitle asChild>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingTitle(true)}
                                    className="flex min-h-9 w-full min-w-0 items-center text-left [overflow-wrap:anywhere]"
                                >
                                    {card.title}
                                </button>
                            </DialogTitle>
                        )}
                        <div className="flex min-w-0 items-center text-sm text-muted-foreground">
                            <label htmlFor="card-list" className="shrink-0">
                                in list
                            </label>
                            <ListSelect
                                id="card-list"
                                lists={lists}
                                value={list.id}
                                // To the top of the chosen list; exact position - Move… on the card.
                                onValueChange={(toListId) =>
                                    moveCard(card.id, toListId, 0)
                                }
                                className="w-auto border-none bg-transparent px-1.5 font-medium text-foreground shadow-none data-[size=default]:h-7 dark:bg-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Card actions"
                                >
                                    <EllipsisIcon />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => void handleDelete()}
                                >
                                    <Trash2Icon />
                                    Delete card
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Close"
                            >
                                <XIcon />
                            </Button>
                        </DialogClose>
                    </div>
                </div>

                {/* min-w-0: a grid item of DialogContent. */}
                <div className="min-w-0 space-y-6">
                    {/* Labels and due date in one row, or the buttons of the
                        empty blocks (Labels / Due date / Checklist) - go here. */}

                    <div>
                        <label
                            htmlFor="card-description"
                            className="mb-2 flex items-center gap-2 text-sm font-medium"
                        >
                            <TextIcon className="size-4 text-muted-foreground" />
                            Description
                        </label>
                        <Textarea
                            id="card-description"
                            value={description}
                            placeholder="Add a description…"
                            rows={5}
                            className="h-40 resize-none overflow-y-auto field-sizing-fixed"
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        {description.trim() !== (card.description ?? '') && (
                            <div className="mt-3 flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelDescription}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={saveDescription}>
                                    Save
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Checklist block - goes here. */}

                    <CardDates card={card} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

// "Created Oct 3 · Updated today". Relative to the device's date, so it is
// rendered on the client only: the server doesn't know the device's time zone.
function CardDates({ card }: { card: Card }) {
    const hydrated = useHydrated();
    if (!hydrated) return null;

    const now = new Date();
    const isUpdated = card.updatedAt.getTime() !== card.createdAt.getTime();
    return (
        <p className="text-xs text-muted-foreground">
            Created {formatCardDate(card.createdAt, now)}
            {isUpdated && ` · Updated ${formatCardDate(card.updatedAt, now)}`}
        </p>
    );
}

function formatCardDate(date: Date, now: Date) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return 'today';
    if (date.toDateString() === yesterday.toDateString()) return 'yesterday';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
    });
}
