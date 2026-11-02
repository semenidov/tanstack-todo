import { db } from '#/db';
import { boardMembers, boards } from '#/db/schema';
import type { Action } from '#/lib/permissions';
import { can, Role } from '#/lib/permissions';
import { and, eq } from 'drizzle-orm';

export const BOARD_ACCESS_DENIED = "Board not found or you don't have access";
declare const boardAccessBrand: unique symbol;
export interface BoardAccess {
    readonly userId: string;
    readonly boardId: string;
    readonly role: Role;
    readonly [boardAccessBrand]: true;
}

export async function authorizeBoard(
    user: { id: string },
    boardId: string,
    action: Action,
): Promise<BoardAccess> {
    const rows = await db
        .select({ ownerId: boards.ownerId, memberRole: boardMembers.role })
        .from(boards)
        .leftJoin(
            boardMembers,
            and(
                eq(boardMembers.boardId, boards.id),
                eq(boardMembers.userId, user.id),
            ),
        )
        .where(eq(boards.id, boardId));
    const row = rows.at(0);
    const role = row?.ownerId === user.id ? Role.Owner : row?.memberRole;
    if (!role || !can(role, action)) throw new Error(BOARD_ACCESS_DENIED);
    return { userId: user.id, boardId, role } as BoardAccess;
}
