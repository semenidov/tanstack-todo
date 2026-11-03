import { db } from '#/db';
import {
    boardMembers,
    boards,
    cards,
    lists,
    checklists,
    checklistItems,
    labels,
} from '#/db/schema';
import type { Action } from '#/lib/permissions';
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
    includeDeleted = false,
): Promise<BoardAccess> {
    const rows = await db
        .select({ boardId: lists.boardId })
        .from(cards)
        .innerJoin(lists, eq(cards.listId, lists.id))
        .where(
            and(
                eq(cards.id, cardId),
                includeDeleted ? undefined : isNull(cards.deletedAt),
                isNull(lists.deletedAt),
            ),
        );
    const row = rows.at(0);
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeBoard(userId, row.boardId, action);
}

export async function authorizeList(
    userId: string,
    listId: string,
    action: Action,
    includeDeleted = false,
): Promise<BoardAccess> {
    const row = await db.query.lists.findFirst({
        where: and(
            eq(lists.id, listId),
            includeDeleted ? undefined : isNull(lists.deletedAt),
        ),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeBoard(userId, row.boardId, action);
}
export async function authorizeLabel(
    userId: string,
    labelId: string,
    action: Action,
): Promise<BoardAccess> {
    const row = await db.query.labels.findFirst({
        where: eq(labels.id, labelId),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeBoard(userId, row.boardId, action);
}
export async function authorizeChecklist(
    userId: string,
    checklistId: string,
    action: Action,
): Promise<BoardAccess> {
    const row = await db.query.checklists.findFirst({
        where: eq(checklists.id, checklistId),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeCard(userId, row.cardId, action);
}
export async function authorizeChecklistItem(
    userId: string,
    itemId: string,
    action: Action,
): Promise<BoardAccess> {
    const row = await db.query.checklistItems.findFirst({
        where: eq(checklistItems.id, itemId),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeChecklist(userId, row.checklistId, action);
}
export function requireChanged<T>(result: T): NonNullable<T> {
    if (!result || (Array.isArray(result) && result.length === 0))
        throw new Error(BOARD_ACCESS_DENIED);
    return result;
}
