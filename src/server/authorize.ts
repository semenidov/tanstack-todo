import { db } from '#/db';
import { boardMembers, boards, cards, lists } from '#/db/schema';
import type { Action} from '#/lib/permissions';
import { BOARD_ACCESS_DENIED, can, Role } from '#/lib/permissions';
import { and, eq, isNull } from 'drizzle-orm';

declare const boardAccess: unique symbol;
export type BoardAccess = {
    readonly userId: string;
    readonly boardId: string;
    readonly role: Role;
    readonly [boardAccess]: true;
};

export async function authorizeBoard(
    userId: string,
    boardId: string,
    action: Action,
): Promise<BoardAccess> {
    const rows = await db
        .select({ ownerId: boards.ownerId, role: boardMembers.role })
        .from(boards)
        .leftJoin(
            boardMembers,
            and(
                eq(boardMembers.boardId, boards.id),
                eq(boardMembers.userId, userId),
            ),
        )
        .where(eq(boards.id, boardId));
    const row = rows.at(0);
    const role = row?.ownerId === userId ? Role.Owner : row?.role;
    if (!role || !can(role, action)) throw new Error(BOARD_ACCESS_DENIED);
    return { userId, boardId, role } as BoardAccess;
}

// Reading a card's checklist needs the board permission too.
export async function authorizeCard(
    userId: string,
    cardId: string,
    action: Action,
): Promise<BoardAccess> {
    const rows = await db
        .select({ boardId: lists.boardId })
        .from(cards)
        .innerJoin(lists, eq(cards.listId, lists.id))
        .where(
            and(
                eq(cards.id, cardId),
                isNull(cards.deletedAt),
                isNull(lists.deletedAt),
            ),
        );
    const row = rows.at(0);
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeBoard(userId, row.boardId, action);
}
