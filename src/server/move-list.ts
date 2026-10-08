import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';

export interface MoveListInput {
    listId: string;
    toBoardId: string;
    prevListId: string | null;
    nextListId: string | null;
}

/**
 * The body of `moveListServer`, apart from it so a test can call it (vitest has
 * no Start runtime). Imported only inside the server fn handler: the client build
 * drops it together with the handler.
 */
export async function moveListOrThrow(user: SessionUser, data: MoveListInput) {
    const row = await repo.moveList(
        user.id,
        data.listId,
        data.toBoardId,
        data.prevListId,
        data.nextListId,
        quotasFor(user),
    );
    // A refusal (foreign board, stale neighbors, deleted list) must reach the
    // client as an error: it shows a toast and refetches the board.
    if (!row) throw new Error('List was not moved');
}
