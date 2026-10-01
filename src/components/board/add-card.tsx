import { useEffect, useRef, useState } from 'react';
import { useAddCard } from '#/components/board/card-mutations';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Loader2Icon, PlusIcon } from 'lucide-react';

interface AddCardProps {
    boardId: string;
    listId: string;
}

export function AddCard({ boardId, listId }: AddCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const addCard = useAddCard(boardId, listId);

    useEffect(() => {
        if (isEditing) inputRef.current?.focus();
    }, [isEditing]);

    function close() {
        setIsEditing(false);
        setValue('');
    }

    function handleSubmit() {
        const trimmed = value.trim();
        if (!trimmed || addCard.isPending) return;
        // Cleared only after success, so a failed request keeps the typed text.
        addCard.mutate(trimmed, {
            onSuccess: () => {
                setValue('');
                inputRef.current?.focus();
            },
        });
    }

    if (!isEditing) {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setIsEditing(true)}
            >
                <PlusIcon />
                Add card
            </Button>
        );
    }

    return (
        <div className="relative">
            {/* readOnly, not disabled: the field keeps focus while the request is pending. */}
            <Input
                ref={inputRef}
                value={value}
                placeholder="Card title"
                aria-label="New card title"
                readOnly={addCard.isPending}
                aria-busy={addCard.isPending}
                className="h-8 pr-8"
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => {
                    if (!addCard.isPending) close();
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
            {addCard.isPending && (
                <Loader2Icon
                    aria-hidden="true"
                    className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                />
            )}
        </div>
    );
}
