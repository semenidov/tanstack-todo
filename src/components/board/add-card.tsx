import { useEffect, useRef, useState } from 'react';
import { useAddCard } from '#/components/board/card-mutations';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { PlusIcon } from 'lucide-react';

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
        if (!trimmed) return;
        addCard.mutate(trimmed);
        setValue('');
        inputRef.current?.focus();
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
        <Input
            ref={inputRef}
            value={value}
            placeholder="Card title"
            aria-label="New card title"
            className="h-8"
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
    );
}
