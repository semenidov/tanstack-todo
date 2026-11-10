import { Action } from '#/lib/permissions';
import {
    authorizeBoard,
    authorizeList,
    requireChanged,
} from '#/server/authorize';
import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';

interface MoveListInput {
    listId: string;
    toBoardId: string;
    prevListId: string | null;
    nextListId: string | null;
}

export async function moveListOrThrow(user: SessionUser, data: MoveListInput) {
    let access = await authorizeList(user.id, data.listId, Action.ContentEdit);
    const targetAccess =
        data.toBoardId === access.boardId
            ? access
            : await authorizeBoard(
                  user.id,
                  data.toBoardId,
                  Action.ListMoveToBoard,
              );
    if (data.toBoardId !== access.boardId)
        access = await authorizeList(
            user.id,
            data.listId,
            Action.ListMoveToBoard,
        );
    const row = await repo.moveList(
        access,
        data.listId,
        targetAccess,
        data.prevListId,
        data.nextListId,
        quotasFor(user),
    );
    requireChanged(row);
}
