import { useEffect, useRef, useState } from 'react';
import { Badge } from '#/components/ui/badge';
import { Input } from '#/components/ui/input';

interface ListTitleProps {
    title: string;
    count: number;
    isEditing: boolean;
    disabled?: boolean;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: (title: string) => void;
}

export function ListTitle({
    title,
    count,
    isEditing,
    disabled = false,
    onStartEditing,
    onCancelEditing,
    onSave,
}: ListTitleProps) {
    const [value, setValue] = useState(title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            setValue(title);
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing, title]);

    function commit() {
        const trimmed = value.trim();
        if (trimmed && trimmed !== title) {
            onSave(trimmed);
        }
        onCancelEditing();
    }

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                value={value}
                aria-label="List title"
                className="h-7 min-w-0 flex-1 px-2 text-sm font-medium"
                onChange={(e) => setValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit();
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancelEditing();
                    }
                }}
            />
        );
    }

    return (
        <button
            type="button"
            onClick={onStartEditing}
            disabled={disabled}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left text-sm font-medium"
        >
            <span className="truncate">{title}</span>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
                {count}
            </Badge>
        </button>
    );
}
