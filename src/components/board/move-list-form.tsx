import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { ListSelect } from '#/components/board/list-select';
import { Button } from '#/components/ui/button';
import { Label } from '#/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select';
import { boardQueryOptions, boardsListQueryOptions } from '#/lib/boards-query';
import type { ListWithCards } from '#/lib/boards-query';

interface BoardRef {
    id: string;
    title: string;
}

interface MoveListFormProps {
    list: ListWithCards;
    /** The board the list is on. */
    board: BoardRef;
    /** The lists of that board, in the order shown. */
    lists: Array<ListWithCards>;
    /** A move of the list or its cards is in the queue: no move to another board yet. */
    isSyncing: boolean;
    /** `index` counts in the target board without the list: position N is N - 1. */
    onMove: (toBoard: BoardRef, index: number) => void;
}

// Content of the list's Move… popover: a board, a 1-based position on it, and Move.
export function MoveListForm({
    list,
    board,
    lists,
    isSyncing,
    onMove,
}: MoveListFormProps) {
    const id = useId();
    const [boardId, setBoardId] = useState(board.id);
    const [position, setPosition] = useState(1);
    const isOtherBoard = boardId !== board.id;

    const boardsQuery = useQuery(boardsListQueryOptions);
    // Until the boards load, the current board is the only choice.
    const boards = boardsQuery.data ?? [board];
    const target = boards.find((b) => b.id === boardId) ?? board;

    // Positions on another board come with its data, loaded when it is picked.
    const targetQuery = useQuery({
        ...boardQueryOptions(boardId),
        enabled: isOtherBoard,
    });
    const targetLists = isOtherBoard ? targetQuery.data?.lists : lists;

    const others = targetLists?.filter((l) => l.id !== list.id) ?? [];
    // On the current board 1..N, on another one 1..N+1: both are «others + 1».
    const positionCount = others.length + 1;
    const currentIndex = isOtherBoard
        ? -1
        : lists.findIndex((l) => l.id === list.id);
    const isSameSpot = currentIndex !== -1 && currentIndex === position - 1;
    const canMove =
        targetLists !== undefined &&
        !isSameSpot &&
        !(isOtherBoard && isSyncing);

    return (
        <form
            className="grid min-w-0 grid-cols-1 gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (canMove) {
                    onMove(
                        { id: target.id, title: target.title },
                        position - 1,
                    );
                }
            }}
        >
            <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`${id}-board`}>Board</Label>
                {/* The list picker fits boards too: id + title, cut with an ellipsis. */}
                <ListSelect
                    id={`${id}-board`}
                    lists={boards}
                    value={boardId}
                    onValueChange={(value) => {
                        setBoardId(value);
                        setPosition(1);
                    }}
                />
            </div>
            <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`${id}-position`}>Position</Label>
                <Select
                    value={String(position)}
                    onValueChange={(value) => setPosition(Number(value))}
                    disabled={targetLists === undefined}
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
            <Button type="submit" disabled={!canMove}>
                Move
            </Button>
        </form>
    );
}
