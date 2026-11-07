import { db } from '#/db';
import { boardMembers, boards } from '#/db/schema';
import type { BoardAccess } from './authorize';
import { and, eq, inArray, ne } from 'drizzle-orm';

export function leaveBoard(access: BoardAccess) {
    return db
        .delete(boardMembers)
        .where(
            and(
                eq(boardMembers.boardId, access.boardId),
                eq(boardMembers.userId, access.userId),
                inArray(
                    boardMembers.boardId,
                    db
                        .select({ id: boards.id })
                        .from(boards)
                        .where(ne(boards.ownerId, access.userId)),
                ),
            ),
        )
        .returning();
}
