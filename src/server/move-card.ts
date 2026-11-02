import { authorizeCard, requireAffected } from '#/server/authorize';
import { Action } from '#/lib/permissions';
import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';

export interface MoveCardInput {
    cardId: string;
    toListId: string;
    prevCardId: string | null;
    nextCardId: string | null;
}

export async function moveCardOrThrow(user: SessionUser, data: MoveCardInput) {
    requireAffected(
        await repo.moveCard(
            await authorizeCard(user, data.cardId, Action.ContentEdit),
            data.cardId,
            data.toListId,
            data.prevCardId,
            data.nextCardId,
            quotasFor(user),
        ),
    );
}
