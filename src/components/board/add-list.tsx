import { useEffect, useRef, useState } from 'react';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { addListToBoard } from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import { addListServer } from '#/server/boards';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

function useAddList(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    return useMutation({
        mutationFn: (title: string) =>
            addListServer({ data: { boardId, title } }),
        onMutate: async (title) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old) =>
                old
                    ? addListToBoard(old, {
                          id: crypto.randomUUID(),
                          boardId,
                          title,
                          createdAt: new Date(),
                          updatedAt: new Date(),
                          cards: [],
                      })
                    : old,
            );
            return { previous };
        },
        onError: (_error, _title, context) => {
            queryClient.setQueryData(key, context?.previous);
            toast.error("Couldn't add the list. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
        },
    });
}

export function AddList({ boardId }: { boardId: string }) {
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
        if (!trimmed) return;
        addList.mutate(trimmed);
        setValue('');
        inputRef.current?.focus();
    }

    if (!isEditing) {
        return (
            <Button
                variant="outline"
                className="h-10 w-[85vw] shrink-0 snap-start justify-start sm:w-72"
                onClick={() => setIsEditing(true)}
            >
                <PlusIcon />
                Add list
            </Button>
        );
    }

    return (
        <div className="w-[85vw] shrink-0 snap-start sm:w-72">
            <Input
                ref={inputRef}
                value={value}
                placeholder="List title"
                aria-label="New list title"
                onChange={(e) => setValue(e.target.value)}
                onBlur={close}
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
        </div>
    );
}
