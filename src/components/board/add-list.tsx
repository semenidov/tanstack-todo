import { useEffect, useRef, useState } from 'react';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { addListToBoard } from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import { createErrorMessage } from '#/lib/quotas';
import { addListServer } from '#/server/boards';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';

function useAddList(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    // Not optimistic: the list enters the cache only with the id the server gave it.
    return useMutation({
        mutationFn: async (title: string) => {
            const list = await addListServer({ data: { boardId, title } });
            // null: the board is gone or belongs to someone else.
            if (!list) throw new Error('List was not created');
            return list;
        },
        onSuccess: async (list) => {
            await queryClient.cancelQueries({ queryKey: key });
            queryClient.setQueryData(key, (old) =>
                old ? addListToBoard(old, { ...list, cards: [] }) : old,
            );
        },
        onError: (error) => {
            toast.error(
                createErrorMessage(
                    error,
                    "Couldn't add the list. Please try again.",
                ),
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
        },
    });
}

interface AddListProps {
    boardId: string;
    className?: string;
}

export function AddList({ boardId, className }: AddListProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const addList = useAddList(boardId);

    useEffect(() => {
        if (isEditing) inputRef.current?.focus();
    }, [isEditing]);

    function close() {
        setIsEditing(false);
        setValue('');
    }

    function handleSubmit() {
        const trimmed = value.trim();
        if (!trimmed || addList.isPending) return;
        // Cleared only after success, so a failed request keeps the typed text.
        addList.mutate(trimmed, {
            onSuccess: () => {
                setValue('');
                inputRef.current?.focus();
            },
        });
    }

    if (!isEditing) {
        return (
            <Button
                variant="outline"
                className={cn(
                    'h-10 w-[85vw] shrink-0 snap-center justify-start sm:w-72 sm:snap-start',
                    className,
                )}
                onClick={() => setIsEditing(true)}
            >
                <PlusIcon />
                Add list
            </Button>
        );
    }

    return (
        <div
            className={cn(
                'w-[85vw] shrink-0 snap-center sm:w-72 sm:snap-start',
                className,
            )}
        >
            {/* Own wrapper: the outer one stretches to the row height, the spinner must
                center on the field, not on the row. */}
            <div className="relative">
                {/* readOnly, not disabled: the field keeps focus while the request is pending. */}
                <Input
                    ref={inputRef}
                    value={value}
                    placeholder="List title"
                    aria-label="New list title"
                    readOnly={addList.isPending}
                    aria-busy={addList.isPending}
                    className="pr-8"
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => {
                        if (!addList.isPending) close();
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
                {addList.isPending && (
                    <Loader2Icon
                        aria-hidden="true"
                        className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                    />
                )}
            </div>
        </div>
    );
}
