import { useState } from 'react';
import { Input } from '#/components/ui/input';
import { boardsListQueryOptions } from '#/lib/boards-query';
import { createBoardServer } from '#/server/boards';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2Icon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';

const TILE_CLASS = 'h-24 rounded-lg border border-dashed p-3 text-sm';

interface CreateBoardTileProps {
    className?: string;
}

export function CreateBoardTile({ className }: CreateBoardTileProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState('');
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Not optimistic: the new board must be opened by its real id.
    const createBoard = useMutation({
        mutationFn: (title: string) => createBoardServer({ data: { title } }),
        onSuccess: async (board) => {
            await queryClient.invalidateQueries({
                queryKey: boardsListQueryOptions.queryKey,
            });
            await navigate({
                to: '/b/$boardId',
                params: { boardId: board.id },
            });
        },
        onError: () => {
            toast.error("Couldn't create the board. Please try again.");
        },
    });

    function close() {
        setIsEditing(false);
        setValue('');
    }

    function handleSubmit() {
        const trimmed = value.trim();
        if (!trimmed || createBoard.isPending) return;
        createBoard.mutate(trimmed);
    }

    if (!isEditing) {
        return (
            <button
                type="button"
                className={cn(
                    TILE_CLASS,
                    'flex w-full items-center justify-center gap-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    className,
                )}
                onClick={() => setIsEditing(true)}
            >
                <PlusIcon className="size-4" />
                Create board
            </button>
        );
    }

    return (
        <div className={cn(TILE_CLASS, className)}>
            <div className="relative">
                {/* readOnly, not disabled: the field keeps focus while the request is pending. */}
                <Input
                    autoFocus
                    value={value}
                    placeholder="Board title"
                    aria-label="New board title"
                    readOnly={createBoard.isPending}
                    aria-busy={createBoard.isPending}
                    className="h-7 pl-2 pr-8 text-sm"
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => {
                        if (!createBoard.isPending) close();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSubmit();
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            close();
                        }
                    }}
                />
                {createBoard.isPending && (
                    <Loader2Icon
                        aria-hidden="true"
                        className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                    />
                )}
            </div>
        </div>
    );
}
