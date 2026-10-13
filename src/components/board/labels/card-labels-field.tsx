import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { LabelChip } from '#/components/board/labels/label-strip';
import { LabelsPopover } from '#/components/board/labels/labels-popover';
import type { LabelsPopoverProps } from '#/components/board/labels/labels-popover';
import { Button } from '#/components/ui/button';
import { labelsOfCard } from '#/lib/labels';
import { labelsQueryOptions } from '#/lib/labels-query';

/** The "Labels" button in the row of empty blocks of the card window. */
export function AddLabelsButton(props: LabelsPopoverProps) {
    return (
        <LabelsPopover {...props}>
            <Button type="button" variant="secondary" size="sm">
                <PlusIcon />
                Labels
            </Button>
        </LabelsPopover>
    );
}

/** The labels block of the card window: chips in label order and «+». */
export function CardLabelsField(props: LabelsPopoverProps) {
    const { data } = useQuery(labelsQueryOptions(props.boardId));
    const labels = labelsOfCard(data ?? [], props.card.labelIds);

    return (
        <div className="min-w-0">
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                Labels
            </h3>
            <div className="flex min-w-0 flex-wrap gap-1.5">
                {labels.map((label) => (
                    <LabelChip
                        key={label.id}
                        label={label}
                        className="h-8 max-w-48 px-3 text-sm leading-8"
                    />
                ))}
                <LabelsPopover {...props}>
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        aria-label="Edit labels"
                        className="size-8"
                    >
                        <PlusIcon />
                    </Button>
                </LabelsPopover>
            </div>
        </div>
    );
}
