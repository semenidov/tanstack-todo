import { Action } from '#/lib/permissions';
import { authorizeCard, requireChanged } from '#/server/authorize';
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
    const access = await authorizeCard(
        user.id,
        data.cardId,
        Action.ContentEdit,
    );
    const row = await repo.moveCard(
        access,
        data.cardId,
        data.toListId,
        data.prevCardId,
        data.nextCardId,
        quotasFor(user),
    );
    requireChanged(row);
}
