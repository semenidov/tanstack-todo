import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { LabelChip } from '#/components/board/labels/label-strip';
import type { PopoverButtonProps } from '#/components/responsive-popover';
import { Button } from '#/components/ui/button';
import type { Card } from '#/lib/boards-query';
import { labelsOfCard } from '#/lib/labels';
import { labelsQueryOptions } from '#/lib/labels-query';

export function AddLabelsButton({
    buttonProps,
}: {
    buttonProps: PopoverButtonProps;
}) {
    return (
        <Button type="button" variant="secondary" size="sm" {...buttonProps}>
            <PlusIcon />
            Labels
        </Button>
    );
}

export function CardLabelsField({
    boardId,
    card,
    buttonProps,
}: {
    boardId: string;
    card: Card;
    buttonProps: PopoverButtonProps;
}) {
    const { data } = useQuery(labelsQueryOptions(boardId));
    const labels = labelsOfCard(data ?? [], card.labelIds);

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
                <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    aria-label="Edit labels"
                    className="size-8"
                    {...buttonProps}
                >
                    <PlusIcon />
                </Button>
            </div>
        </div>
    );
}
