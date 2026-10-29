import type { ReactNode } from 'react';
import { DueBadge } from '#/components/board/due/due-badge';
import { LabelStrip } from '#/components/board/labels/label-strip';
import type { Card } from '#/lib/boards-query';
import { cn } from 'cn';
import { CheckIcon, SquareCheckBigIcon, TextIcon } from 'lucide-react';

interface CardFaceProps {
    card: Card;
    title?: ReactNode;
}

export function CardFace({ card, title }: CardFaceProps) {
    const badges: Array<ReactNode> = [];
    if (card.dueDate || card.dueAt) {
        badges.push(
            <DueBadge
                key="due"
                due={card}
                completed={card.completedAt !== null}
            />,
        );
    }
    if (card.checklistTotal > 0) {
        const complete = card.checklistDone === card.checklistTotal;
        badges.push(
            <span
                key="checklist"
                className={cn(
                    'flex items-center gap-1 tabular-nums',
                    complete && 'text-green-600 dark:text-green-500',
                )}
            >
                <SquareCheckBigIcon className="size-3.5" />
                <span className="sr-only">Checklist: </span>
                {card.checklistDone}/{card.checklistTotal}
            </span>,
        );
    }
    if (card.description) {
        badges.push(
            <span key="description" role="img" aria-label="Has description">
                <TextIcon className="size-3.5" />
            </span>,
        );
    }

    return (
        <div className="flex flex-col gap-1.5 px-3 py-2 pr-8 text-sm select-none">
            {card.labelIds.length > 0 && (
                <LabelStrip
                    labelIds={card.labelIds}
                    interactive={title !== undefined}
                />
            )}
            <div className="flex min-w-0 items-start gap-1.5">
                {card.completedAt && (
                    <span
                        role="img"
                        aria-label="Completed"
                        className="flex h-5 shrink-0 items-center text-green-600 dark:text-green-500"
                    >
                        <CheckIcon className="size-4" strokeWidth={3} />
                    </span>
                )}
                <div
                    title={card.title}
                    className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]"
                >
                    {title ?? card.title}
                </div>
            </div>
            {badges.length > 0 && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {badges}
                </div>
            )}
        </div>
    );
}
