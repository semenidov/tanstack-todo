import { db } from '#/db';
import { boardMembers, boards, user  } from '#/db/schema';
import type { BoardAccess } from './authorize';
import { and, eq, inArray, ne, sql  } from 'drizzle-orm';

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

function ownerBoardIds(access: BoardAccess) {
    return db
        .select({ id: boards.id })
        .from(boards)
        .where(
            and(
                eq(boards.id, access.boardId),
                eq(boards.ownerId, access.userId),
            ),
        );
}

export async function getSharing(access: BoardAccess) {
    const board = await db
        .select({ token: boards.inviteToken })
        .from(boards)
        .where(inArray(boards.id, ownerBoardIds(access)));
    if (!board[0]) return undefined;
    const members = await db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            isAnonymous: user.isAnonymous,
        })
        .from(boardMembers)
        .innerJoin(user, eq(user.id, boardMembers.userId))
        .where(
            and(
                eq(boardMembers.boardId, access.boardId),
                inArray(boardMembers.boardId, ownerBoardIds(access)),
            ),
        );
    return {
        token: board[0].token,
        members: members.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.isAnonymous ? null : m.email,
        })),
    };
}

export function shareBoard(access: BoardAccess, token: string, reset: boolean) {
    return db
        .update(boards)
        .set({
            inviteToken: reset
                ? token
                : sql`coalesce(${boards.inviteToken}, ${token})`,
        })
        .where(inArray(boards.id, ownerBoardIds(access)))
        .returning({ token: boards.inviteToken });
}

export function removeMember(access: BoardAccess, memberId: string) {
    return db
        .delete(boardMembers)
        .where(
            and(
                eq(boardMembers.boardId, access.boardId),
                eq(boardMembers.userId, memberId),
                ne(boardMembers.userId, access.userId),
                inArray(boardMembers.boardId, ownerBoardIds(access)),
            ),
        )
        .returning();
}
