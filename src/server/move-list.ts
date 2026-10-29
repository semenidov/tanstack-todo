import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';

export interface MoveListInput {
    listId: string;
    toBoardId: string;
    prevListId: string | null;
    nextListId: string | null;
}

export async function moveListOrThrow(user: SessionUser, data: MoveListInput) {
    const row = await repo.moveList(
        user.id,
        data.listId,
        data.toBoardId,
        data.prevListId,
        data.nextListId,
        quotasFor(user),
    );
    if (!row) throw new Error('List was not moved');
}
