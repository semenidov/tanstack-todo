import { db } from '#/db';
import { Role } from '#/lib/permissions';
import { boardMembers, boards, user } from '#/db/schema';
import type { BoardAccess, InviteAccess } from './authorize';
import { accessibleBoardIds } from './access';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

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

function accessibleBoardFor(access: BoardAccess) {
    return db
        .select({ id: boards.id })
        .from(boards)
        .where(
            and(
                eq(boards.id, access.boardId),
                inArray(boards.id, accessibleBoardIds(access.userId)),
            ),
        );
}

export async function getSharing(access: BoardAccess) {
    const board = await db
        .select({ token: boards.inviteToken })
        .from(boards)
        .where(inArray(boards.id, accessibleBoardFor(access)));
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
                inArray(boardMembers.boardId, accessibleBoardFor(access)),
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
        .where(inArray(boards.id, accessibleBoardFor(access)))
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
                inArray(boardMembers.boardId, accessibleBoardFor(access)),
            ),
        )
        .returning();
}

export async function getInvite(access: InviteAccess) {
    const invites = await db
        .select({
            boardId: boards.id,
            title: boards.title,
            ownerName: user.name,
            joined: sql<boolean>`${boards.ownerId} = ${access.userId} or ${boardMembers.userId} is not null`,
        })
        .from(boards)
        .innerJoin(user, eq(user.id, boards.ownerId))
        .leftJoin(
            boardMembers,
            and(
                eq(boardMembers.boardId, boards.id),
                eq(boardMembers.userId, access.userId),
            ),
        )
        .where(
            and(
                eq(boards.id, access.boardId),
                eq(boards.inviteToken, access.token),
            ),
        );
    return invites.at(0);
}

export function joinBoard(access: InviteAccess) {
    // Insert from the board so a reset/deletion after authorization rejects the stale token.
    return db
        .insert(boardMembers)
        .select(
            db
                .select({
                    boardId: boards.id,
                    userId: sql<string>`${access.userId}`.as('user_id'),
                    role: sql<Role.Editor>`${Role.Editor}`.as('role'),
                })
                .from(boards)
                .where(
                    and(
                        eq(boards.id, access.boardId),
                        eq(boards.inviteToken, access.token),
                        ne(boards.ownerId, access.userId),
                    ),
                ),
        )
        .onConflictDoNothing()
        .returning();
}
