import { useRef, useState } from 'react';
import {
    useDeleteCard,
    useIsCardSyncing,
    useMoveCard,
} from '#/components/board/card-mutations';
import { MoveCardForm } from '#/components/board/move-card-form';
import { Button } from '#/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from '#/components/ui/popover';
import { cardLinkId } from '#/lib/boards';
import type { Card, ListWithCards } from '#/lib/boards-query';
import { useDelayedFlag } from '#/lib/use-delayed-flag';
import { Link } from '@tanstack/react-router';
import { EllipsisIcon, LoaderCircleIcon } from 'lucide-react';

// A move confirmed faster than this shows no spinner.
const SYNC_SPINNER_DELAY_MS = 300;

interface CardItemProps {
    boardId: string;
    card: Card;
    lists: Array<ListWithCards>;
}

export function CardItem({ boardId, card, lists }: CardItemProps) {
    const { moveCard } = useMoveCard(boardId);
    const { deleteWithUndo } = useDeleteCard(boardId);
    const isSyncing = useIsCardSyncing(boardId, card.id);
    const showSpinner = useDelayedFlag(isSyncing, SYNC_SPINNER_DELAY_MS);
    const [isMoveOpen, setIsMoveOpen] = useState(false);
    // The popover opens once the menu has closed: opening it from onSelect would
    // let the menu's focus return to its trigger and dismiss the popover at once.
    const openMoveOnMenuCloseRef = useRef(false);

    return (
        <Popover open={isMoveOpen} onOpenChange={setIsMoveOpen}>
            <PopoverAnchor asChild>
                <li
                    aria-busy={showSpinner || undefined}
                    className="group/card relative rounded-md border bg-background shadow-xs"
                >
                    <Link
                        to="/b/$boardId/c/$cardId"
                        params={{ boardId, cardId: card.id }}
                        id={cardLinkId(card.id)}
                        className="block truncate px-3 py-2 pr-8 text-sm"
                    >
                        {card.title}
                    </Link>
                    {showSpinner && (
                        <span
                            role="status"
                            aria-label="Saving card position"
                            className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border bg-background"
                        >
                            <LoaderCircleIcon className="size-3 animate-spin text-muted-foreground" />
                        </span>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Card actions"
                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
                            >
                                <EllipsisIcon />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            onCloseAutoFocus={(e) => {
                                if (!openMoveOnMenuCloseRef.current) return;
                                openMoveOnMenuCloseRef.current = false;
                                e.preventDefault();
                                setIsMoveOpen(true);
                            }}
                        >
                            <DropdownMenuItem
                                onSelect={() => {
                                    openMoveOnMenuCloseRef.current = true;
                                }}
                            >
                                Move…
                            </DropdownMenuItem>
                            {/* Deleting a card with a move in flight would race the move. */}
                            <DropdownMenuItem
                                variant="destructive"
                                disabled={isSyncing}
                                onSelect={() => deleteWithUndo(card)}
                            >
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </li>
            </PopoverAnchor>
            <PopoverContent
                align="start"
                aria-label="Move card"
                onCloseAutoFocus={(e) => {
                    // No trigger to return to: focus the card, wherever it is now.
                    e.preventDefault();
                    document.getElementById(cardLinkId(card.id))?.focus();
                }}
            >
                <MoveCardForm
                    card={card}
                    lists={lists}
                    onMove={(toListId, index) => {
                        setIsMoveOpen(false);
                        moveCard(card.id, toListId, index);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
