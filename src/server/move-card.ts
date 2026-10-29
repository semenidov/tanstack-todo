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
    const row = await repo.moveCard(
        user.id,
        data.cardId,
        data.toListId,
        data.prevCardId,
        data.nextCardId,
        quotasFor(user),
    );
    if (!row) throw new Error('Card was not moved');
}
