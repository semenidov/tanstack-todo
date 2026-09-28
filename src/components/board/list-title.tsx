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
    function commit(raw: string) {
        const trimmed = raw.trim();
        if (trimmed && trimmed !== title) {
            onSave(trimmed);
        }
        onCancelEditing();
    }

    if (isEditing) {
        // Mounted anew on every edit, so defaultValue always starts from the current title.
        return (
            <Input
                autoFocus
                defaultValue={title}
                aria-label="List title"
                className="h-7 min-w-0 flex-1 px-2 text-sm font-medium"
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => commit(e.currentTarget.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit(e.currentTarget.value);
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
