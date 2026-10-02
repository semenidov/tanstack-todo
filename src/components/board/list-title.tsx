import { Badge } from '#/components/ui/badge';
import { EditableTitle } from '#/components/editable-title';

interface ListTitleProps {
    title: string;
    count: number;
    isEditing: boolean;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: (title: string) => void;
}

export function ListTitle({ count, ...props }: ListTitleProps) {
    return (
        <EditableTitle
            {...props}
            aria-label="List title"
            className="flex flex-1 items-center gap-2 rounded-sm text-sm font-medium"
            inputClassName="h-7 min-w-0 flex-1 px-2 text-sm font-medium"
        >
            <Badge variant="secondary" className="shrink-0 tabular-nums">
                {count}
            </Badge>
        </EditableTitle>
    );
}
