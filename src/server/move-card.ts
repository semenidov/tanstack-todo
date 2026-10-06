import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';

export interface MoveCardInput {
    cardId: string;
    toListId: string;
    prevCardId: string | null;
    nextCardId: string | null;
}

/**
 * The body of `moveCardServer`, apart from it so a unit test can call it (vitest
 * has no Start runtime). Imported only inside the server fn handler: the client
 * build drops it together with the handler.
 */
export async function moveCardOrThrow(user: SessionUser, data: MoveCardInput) {
    const row = await repo.moveCard(
        user.id,
        data.cardId,
        data.toListId,
        data.prevCardId,
        data.nextCardId,
        quotasFor(user),
    );
    // A refusal (foreign or stale neighbors, deleted list) must reach the client
    // as an error: it shows a toast and refetches the board.
    if (!row) throw new Error('Card was not moved');
}
