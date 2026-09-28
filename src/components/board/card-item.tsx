import { useDeleteCard, useMoveCard } from '#/components/board/card-mutations';
import { Button } from '#/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import { cardLinkId, isTempId } from '#/lib/boards';
import type { Card, ListWithCards } from '#/lib/boards-query';
import { Link } from '@tanstack/react-router';
import { EllipsisIcon } from 'lucide-react';

interface CardItemProps {
    boardId: string;
    card: Card;
    otherLists: Array<ListWithCards>;
}

export function CardItem({ boardId, card, otherLists }: CardItemProps) {
    const moveCard = useMoveCard(boardId);
    const { deleteWithUndo } = useDeleteCard(boardId);
    // Not saved yet: its id is temporary, so opening/moving/deleting it would hit a missing card.
    const isSaving = isTempId(card.id);

    return (
        <li className="group/card relative rounded-md border bg-background shadow-xs">
            <Link
                to="/b/$boardId/c/$cardId"
                params={{ boardId, cardId: card.id }}
                id={cardLinkId(card.id)}
                disabled={isSaving}
                className="block truncate px-3 py-2 pr-8 text-sm"
            >
                {card.title}
            </Link>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Card actions"
                        disabled={isSaving}
                        className="absolute right-1 top-1 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
                    >
                        <EllipsisIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger
                            disabled={otherLists.length === 0}
                        >
                            Move to…
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {otherLists.map((list) => (
                                <DropdownMenuItem
                                    key={list.id}
                                    onSelect={() =>
                                        moveCard.mutate({
                                            cardId: card.id,
                                            toListId: list.id,
                                        })
                                    }
                                >
                                    {list.title}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => deleteWithUndo(card)}
                    >
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}
