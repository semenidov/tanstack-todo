import {
    authorizeBoard,
    authorizeList,
    requireAffected,
} from '#/server/authorize';
import { Action } from '#/lib/permissions';
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
    let source = await authorizeList(user, data.listId, Action.ContentEdit);
    const target =
        data.toBoardId === source.boardId
            ? source
            : await authorizeBoard(
                  user,
                  data.toBoardId,
                  Action.ListMoveToBoard,
              );
    if (data.toBoardId !== source.boardId)
        source = await authorizeList(user, data.listId, Action.ListMoveToBoard);
    requireAffected(
        await repo.moveList(
            source,
            data.listId,
            target,
            data.toBoardId,
            data.prevListId,
            data.nextListId,
            quotasFor(user),
        ),
    );
}
