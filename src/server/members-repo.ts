import { db } from '#/db';
import { boardMembers } from '#/db/schema';
import { scopedBoardIds } from '#/server/access';
import type { BoardAccess } from '#/server/authorize';
import { and, eq, inArray } from 'drizzle-orm';

export async function leaveBoard(access: BoardAccess) {
    return db
        .delete(boardMembers)
        .where(
            and(
                eq(boardMembers.boardId, access.boardId),
                eq(boardMembers.userId, access.userId),
                inArray(boardMembers.boardId, scopedBoardIds(access)),
            ),
        )
        .returning({ boardId: boardMembers.boardId });
}
