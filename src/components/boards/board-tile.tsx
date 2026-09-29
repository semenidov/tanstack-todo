import { useState } from 'react';
import { DeleteBoardDialog } from '#/components/boards/delete-board-dialog';
import { Button } from '#/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import { Input } from '#/components/ui/input';
import type { BoardSummary } from '#/lib/boards-query';
import { Link } from '@tanstack/react-router';
import { EllipsisIcon } from 'lucide-react';

interface BoardTileProps {
    board: BoardSummary;
    onRename: (title: string) => void;
    onDelete: () => void;
}

const TILE_CLASS =
    'block h-24 rounded-lg border bg-card p-3 shadow-xs transition-colors';

export function BoardTile({ board, onRename, onDelete }: BoardTileProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    function commit(raw: string) {
        const trimmed = raw.trim();
        if (trimmed && trimmed !== board.title) onRename(trimmed);
        setIsEditing(false);
    }

    const listsLabel = `${board.listCount} ${board.listCount === 1 ? 'list' : 'lists'}`;

    return (
        <div className="group/tile relative">
            {isEditing ? (
                <div className={TILE_CLASS}>
                    <Input
                        autoFocus
                        defaultValue={board.title}
                        aria-label="Board title"
                        className="h-7 px-2 text-sm font-medium"
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => commit(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                commit(e.currentTarget.value);
                            }
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsEditing(false);
                            }
                        }}
                    />
                    <p className="mt-1 px-2 text-xs text-muted-foreground">
                        {listsLabel}
                    </p>
                </div>
            ) : (
                <Link
                    to="/b/$boardId"
                    params={{ boardId: board.id }}
                    className={`${TILE_CLASS} hover:bg-accent`}
                >
                    <span className="line-clamp-2 pr-7 text-sm font-medium">
                        {board.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
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
