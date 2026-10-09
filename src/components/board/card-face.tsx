import type { ReactNode } from 'react';
import { DueBadge } from '#/components/board/due/due-badge';
import type { Card } from '#/lib/boards-query';
import { CheckIcon, TextIcon } from 'lucide-react';

interface CardFaceProps {
    card: Card;
    /** The title: the card link on the board; plain text in drag previews. */
    title?: ReactNode;
}

// The card on the board and in drag previews (#120). Zones top to bottom:
// labels → [completed check] title (up to 2 lines) → footer badges. An empty
// zone is not rendered, so a card without extras looks like a plain title.
// The menu is not part of the face: CardItem puts it in the top right corner,
// over the right padding.
export function CardFace({ card, title }: CardFaceProps) {
    // Footer badges in a fixed order: due date → checklist → description.
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
    if (card.description) {
        badges.push(
            <span key="description" role="img" aria-label="Has description">
                <TextIcon className="size-3.5" />
            </span>,
        );
    }

    return (
        <div className="flex flex-col gap-1.5 px-3 py-2 pr-8 text-sm select-none">
            {/* Labels zone: strips (labels slice). */}
            <div className="flex min-w-0 items-start gap-1.5">
                {card.completedAt && (
                    // h-5: one line of text-sm, so the check stays on the first line.
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
