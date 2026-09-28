import { CardDialog } from '#/components/board/card-dialog';
import { cardLinkId, findCardInBoard } from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import { pageMeta } from '#/lib/seo';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { toast } from 'sonner';

export const Route = createFileRoute('/b/$boardId/c/$cardId')({
    component: CardRoute,
    // No separate fetch: the card lives in the parent board query's cache.
    loader: ({ context, params }) => {
        const board = context.queryClient.getQueryData(
            boardQueryOptions(params.boardId).queryKey,
        );
        const found = board && findCardInBoard(board, params.cardId);
        return { title: found?.card.title };
    },
    head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.title) }),
});

function CardRoute() {
    const { boardId, cardId } = Route.useParams();
    const navigate = useNavigate();
    const { data } = useSuspenseQuery(boardQueryOptions(boardId));

    const found = data && findCardInBoard(data, cardId);

    useEffect(() => {
        if (data && !found) {
            toast.error('Card not found');
            navigate({ to: '/b/$boardId', params: { boardId } });
        }
    }, [data, found, navigate, boardId]);

    if (!found) return null;

    return (
        <CardDialog
            boardId={boardId}
            card={found.card}
            list={found.list}
            lists={data.lists}
            onClose={async () => {
                await navigate({ to: '/b/$boardId', params: { boardId } });
                // The dialog is opened by navigation, not by a Radix trigger,
                // so Radix has nothing to return focus to - do it explicitly.
                document.getElementById(cardLinkId(cardId))?.focus();
            }}
        />
    );
}
