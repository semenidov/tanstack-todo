import { useId, useState } from 'react';
import { Button } from '#/components/ui/button';
import { Label } from '#/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select';
import type { Card, ListWithCards } from '#/lib/boards-query';

interface MoveCardFormProps {
    card: Card;
    lists: Array<ListWithCards>;
    /** `index` counts in the target list without the card: position N is N - 1. */
    onMove: (toListId: string, index: number) => void;
}

// Content of the Move… popover: a list, a 1-based position in it, and Move.
export function MoveCardForm({ card, lists, onMove }: MoveCardFormProps) {
    const id = useId();
    const [listId, setListId] = useState(card.listId);
    const [position, setPosition] = useState(1);

    const target = lists.find((l) => l.id === listId);
    const others = target?.cards.filter((c) => c.id !== card.id) ?? [];
    // In the current list 1..N, in another one 1..N+1: both are «others + 1».
    const positionCount = others.length + 1;
    const currentIndex = target?.cards.findIndex((c) => c.id === card.id) ?? -1;
    const isSameSpot = currentIndex !== -1 && currentIndex === position - 1;

    return (
        <form
            className="grid min-w-0 grid-cols-1 gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (!isSameSpot) onMove(listId, position - 1);
            }}
        >
            <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`${id}-list`}>List</Label>
                <Select
                    value={listId}
                    onValueChange={(value) => {
                        setListId(value);
                        setPosition(1);
                    }}
                >
                    {/* Long names (up to 200 chars, maybe one word) are cut with an
                        ellipsis; the full name is in the title. */}
                    <SelectTrigger
                        id={`${id}-list`}
                        title={target?.title}
                        // Radix SelectValue drops className: style it from the trigger.
                        className="w-full min-w-0 *:data-[slot=select-value]:min-w-0"
                    >
                        <SelectValue>
                            <span className="min-w-0 truncate">
                                {target?.title}
                            </span>
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {lists.map((list) => (
                            <SelectItem
                                key={list.id}
                                value={list.id}
                                title={list.title}
                                // The item text wrapper must shrink too, or the option overflows.
                                className="max-w-72 *:[span]:last:min-w-0"
                            >
                                <span className="min-w-0 truncate">
                                    {list.title}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`${id}-position`}>Position</Label>
                <Select
                    value={String(position)}
                    onValueChange={(value) => setPosition(Number(value))}
                >
                    <SelectTrigger id={`${id}-position`} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: positionCount }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                                {i + 1}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button type="submit" disabled={isSameSpot}>
                Move
            </Button>
        </form>
    );
}
