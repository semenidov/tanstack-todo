import { useState } from 'react';
import type { ReactNode } from 'react';
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
import {
    AddDueDateButton,
    DueDateField,
} from '#/components/board/due/due-date-field';
import type { Card, ListWithCards } from '#/lib/boards-query';
import { formatCardDate } from '#/lib/due-date';
import type { Due } from '#/lib/due-date';
import { useNow, useTimeZone } from '#/lib/use-time-zone';
import {
    ArrowLeftIcon,
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
    const hasDue = card.dueDate !== null || card.dueAt !== null;
    const [isDueOpen, setIsDueOpen] = useState(false);
    const dueProps = {
        due: card,
        onChange: (due: Due) => updateCard.mutate({ due }),
        open: isDueOpen,
        onOpenChange: setIsDueOpen,
    };

    // Blocks the card has, in one row: labels and due date.
    const blocks: Array<ReactNode> = [];
    // Labels block - goes first here (labels slice).
    if (hasDue) {
        blocks.push(
            <DueDateField key="due" completed={isCompleted} {...dueProps} />,
        );
    }
    // Buttons for the blocks the card doesn't have yet, in the order
    // Labels / Due date / Checklist; a block takes its place once added.
    const emptyBlocks: Array<ReactNode> = [];
    // Labels button - goes first here (labels slice).
    if (!hasDue) {
        emptyBlocks.push(<AddDueDateButton key="due" {...dueProps} />);
    }
    // Checklist button - goes last here (checklist slice).

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
                // Mobile: full screen; from md (as useIsDesktop) a centered window.
                className="max-md:inset-0 max-md:flex max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:overflow-y-auto max-md:rounded-none max-md:border-none max-md:p-4 md:max-h-[90dvh] md:max-w-lg md:overflow-y-auto"
            >
                {/* Header. Desktop: completed toggle → title and its list below
                    → menu and close. Mobile: ← list name ⋯, then toggle and title. */}
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 [grid-template-areas:'back_list_actions'_'check_title_title'] md:[grid-template-areas:'check_title_actions'_'._list_.']">
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Close"
                            className="mt-0.5 [grid-area:back] md:hidden"
                        >
                            <ArrowLeftIcon />
                        </Button>
                    </DialogClose>

                    {/* The only place to mark the card completed. */}
                    <button
                        type="button"
                        role="checkbox"
                        aria-checked={isCompleted}
                        aria-label="Completed"
                        onClick={() =>
                            updateCard.mutate({ completed: !isCompleted })
                        }
                        className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full outline-none [grid-area:check] focus-visible:ring-[3px] focus-visible:ring-ring/50 max-md:ml-0"
                    >
                        {isCompleted ? (
                            <CircleCheckIcon className="size-5 text-green-600 dark:text-green-500" />
                        ) : (
                            <CircleIcon className="size-5 text-muted-foreground" />
                        )}
                    </button>

                    {/* min-w-0: long titles and list names wrap or truncate
                        instead of widening the dialog. */}
                    <div className="min-w-0 [grid-area:title]">
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
                    </div>

                    <div className="flex min-w-0 items-center text-sm text-muted-foreground [grid-area:list] max-md:min-h-9">
                        <label
                            htmlFor="card-list"
                            className="shrink-0 max-md:sr-only"
                        >
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

                    <div className="flex shrink-0 items-center [grid-area:actions] max-md:mt-0.5">
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
                                className="max-md:hidden"
                            >
                                <XIcon />
                            </Button>
                        </DialogClose>
                    </div>
                </div>

                {/* min-w-0: a grid item of DialogContent. */}
                <div className="min-w-0 space-y-6">
                    {blocks.length > 0 && (
                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                            {blocks}
                        </div>
                    )}
                    {emptyBlocks.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {emptyBlocks}
                        </div>
                    )}

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

// "Created Oct 3 · Updated today", by the render time zone like due dates.
function CardDates({ card }: { card: Card }) {
    const timeZone = useTimeZone();
    const now = useNow();
    const isUpdated = card.updatedAt.getTime() !== card.createdAt.getTime();
    return (
        <p className="text-xs text-muted-foreground">
            Created {formatCardDate(card.createdAt, now, timeZone)}
            {isUpdated &&
                ` · Updated ${formatCardDate(card.updatedAt, now, timeZone)}`}
        </p>
    );
}
