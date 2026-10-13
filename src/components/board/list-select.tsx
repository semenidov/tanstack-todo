import { cn } from 'cn';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select';

interface ListSelectProps {
    id: string;
    /** Lists, or boards in the list's Move… window: only id and title are read. */
    lists: Array<{ id: string; title: string }>;
    value: string;
    onValueChange: (listId: string) => void;
    /** Extra trigger classes, e.g. the compact "in list" picker of the card window. */
    className?: string;
}

// List picker of the Move… popover and the card dialog. Long names (up to 200
// chars, maybe one word) are cut with an ellipsis; the full name is in `title`.
export function ListSelect({
    id,
    lists,
    value,
    onValueChange,
    className,
}: ListSelectProps) {
    const selected = lists.find((l) => l.id === value);

    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger
                id={id}
                title={selected?.title}
                // Radix SelectValue drops className: style it from the trigger.
                className={cn(
                    'w-full min-w-0 *:data-[slot=select-value]:min-w-0',
                    className,
                )}
            >
                <SelectValue>
                    <span className="min-w-0 truncate">{selected?.title}</span>
                </SelectValue>
            </SelectTrigger>
            {/* popper: Radix defines --radix-select-trigger-width only in this
                mode, and the options are capped at the trigger width with it. */}
            <SelectContent position="popper">
                {lists.map((list) => (
                    <SelectItem
                        key={list.id}
                        value={list.id}
                        title={list.title}
                        // The item text wrapper must shrink too, or the option overflows.
                        className="max-w-[var(--radix-select-trigger-width)] *:[span]:last:min-w-0"
                    >
                        <span className="min-w-0 truncate">{list.title}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
