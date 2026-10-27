import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
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
import { listLabelLinkCount } from '#/lib/boards';
import { boardQueryOptions, boardsListQueryOptions } from '#/lib/boards-query';
import type { ListWithCards } from '#/lib/boards-query';

interface BoardRef {
    id: string;
    title: string;
}

interface MoveListFormProps {
    list: ListWithCards;
    board: BoardRef;
    lists: Array<ListWithCards>;
    isSyncing: boolean;
    onMove: (toBoard: BoardRef, index: number) => void;
}

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
    const boards = boardsQuery.data ?? [board];
    const target = boards.find((b) => b.id === boardId) ?? board;

    const targetQuery = useQuery({
        ...boardQueryOptions(boardId),
        enabled: isOtherBoard,
    });
    const targetLists = isOtherBoard ? targetQuery.data?.lists : lists;

    const others = targetLists?.filter((l) => l.id !== list.id) ?? [];
    const positionCount = others.length + 1;
    const currentIndex = isOtherBoard
        ? -1
        : lists.findIndex((l) => l.id === list.id);
    const isSameSpot = currentIndex !== -1 && currentIndex === position - 1;
    const removedLabels = isOtherBoard ? listLabelLinkCount(list) : 0;
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
            {removedLabels > 0 && (
                <p className="flex gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                    {removedLabels} {removedLabels === 1 ? 'label' : 'labels'}{' '}
                    will be removed from cards.
                </p>
            )}
            <Button type="submit" disabled={!canMove}>
                Move
            </Button>
        </form>
    );
}
