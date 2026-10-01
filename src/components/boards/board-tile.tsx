import { useState } from 'react';
import { EditableTitle } from '#/components/editable-title';
import { DeleteBoardDialog } from '#/components/boards/delete-board-dialog';
import { Button } from '#/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import type { BoardSummary } from '#/lib/boards-query';
import { Link } from '@tanstack/react-router';
import { EllipsisIcon } from 'lucide-react';

interface BoardTileProps {
    board: BoardSummary;
    onRename: (title: string) => void;
    onDelete: () => void;
}

// Title box is fixed at two lines and the count is pinned to the bottom, so
// switching to the rename input doesn't move anything (CODING.md, Вёрстка).
const TILE_CLASS =
    'flex h-24 flex-col justify-between rounded-lg border bg-card p-3 shadow-xs transition-colors';
const TITLE_BOX_CLASS = 'h-10 pr-7 text-sm leading-5 font-medium';

export function BoardTile({ board, onRename, onDelete }: BoardTileProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const listsLabel = `${board.listCount} ${board.listCount === 1 ? 'list' : 'lists'}`;

    return (
        <div className="group/tile relative">
            {isEditing ? (
                <div className={TILE_CLASS}>
                    <div className={TITLE_BOX_CLASS}>
                        <EditableTitle
                            title={board.title}
                            isEditing
                            aria-label="Board title"
                            inputClassName="h-5 rounded-sm border-none bg-transparent p-0 text-sm leading-5 font-medium shadow-none md:text-sm dark:bg-transparent"
                            onStartEditing={() => setIsEditing(true)}
                            onCancelEditing={() => setIsEditing(false)}
                            onSave={onRename}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {listsLabel}
                    </span>
                </div>
            ) : (
                <Link
                    to="/b/$boardId"
                    params={{ boardId: board.id }}
                    className={`${TILE_CLASS} hover:bg-accent`}
                >
                    <span
                        title={board.title}
                        className={`${TITLE_BOX_CLASS} line-clamp-2 [overflow-wrap:anywhere]`}
                    >
                        {board.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {listsLabel}
                    </span>
                </Link>
            )}
            {!isEditing && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Board actions"
                            className="absolute right-1 top-1 opacity-100 sm:opacity-0 sm:group-hover/tile:opacity-100 sm:focus-visible:opacity-100 sm:data-[state=open]:opacity-100"
                        >
                            <EllipsisIcon />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setIsDeleteDialogOpen(true)}
                        >
                            Delete…
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            <DeleteBoardDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                boardTitle={board.title}
                listCount={board.listCount}
                cardCount={board.cardCount}
                onConfirm={onDelete}
            />
        </div>
    );
}
