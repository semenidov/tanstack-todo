import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { useBoardLabels } from '#/components/board/labels/labels-expanded';
import type { BoardLabelsValue } from '#/components/board/labels/labels-expanded';
import { labelColorStyle } from '#/lib/label-colors';
import { labelName, labelsOfCard } from '#/lib/labels';
import type { Label } from '#/lib/labels';
import { labelsQueryOptions } from '#/lib/labels-query';

/** A label with its title (or only its color), cut with an ellipsis. */
export function LabelChip({
    label,
    className,
}: {
    label: Pick<Label, 'title' | 'color'>;
    className?: string;
}) {
    return (
        <span
            title={label.title ?? undefined}
            className={cn(
                'inline-block max-w-full min-w-10 truncate rounded-sm px-1.5 font-medium',
                labelColorStyle(label.color).className,
                className,
            )}
        >
            {label.title ?? <span className="sr-only">{labelName(label)}</span>}
        </span>
    );
}

interface LabelStripProps {
    labelIds: ReadonlyArray<string>;
    /** On the board: a click toggles the titles. Drag previews are static. */
    interactive: boolean;
}

// The labels zone of a card face: color strips, or chips with titles while the
// board's labels are expanded. In label creation order.
export function LabelStrip(props: LabelStripProps) {
    const board = useBoardLabels();
    // Outside a board there is no labels cache to read the colors from.
    if (!board) return null;
    return <BoardLabelStrip board={board} {...props} />;
}

function BoardLabelStrip({
    board,
    labelIds,
    interactive,
}: LabelStripProps & { board: BoardLabelsValue }) {
    const { data } = useQuery(labelsQueryOptions(board.boardId));
    const labels = labelsOfCard(data ?? [], labelIds);
    if (labels.length === 0) return null;

    const items = labels.map((label) =>
        board.expanded ? (
            <LabelChip
                key={label.id}
                label={label}
                className="h-4 text-[11px] leading-4"
            />
        ) : (
            <span
                key={label.id}
                className={cn(
                    'h-2 w-10 rounded-full',
                    labelColorStyle(label.color).className,
                )}
            />
        ),
    );

    if (!interactive) {
        return <div className="flex min-w-0 flex-wrap gap-1">{items}</div>;
    }
    // relative z-10: above the card link's ::after, so a click toggles the
    // labels and doesn't open or drag the card.
    return (
        <button
            type="button"
            aria-pressed={board.expanded}
            aria-label={`Labels: ${labels.map(labelName).join(', ')}`}
            onClick={board.toggle}
            className="relative z-10 flex max-w-full min-w-0 flex-wrap gap-1 self-start rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
            {items}
        </button>
    );
}
