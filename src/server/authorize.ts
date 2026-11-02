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
import { can, Role } from '#/lib/permissions';
import { and, eq, isNull } from 'drizzle-orm';

import { BOARD_ACCESS_DENIED } from '#/lib/board-access';

export { BOARD_ACCESS_DENIED } from '#/lib/board-access';
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

export function requireAffected<T>(result: T): NonNullable<T> {
    if (
        result == null ||
        result === false ||
        (Array.isArray(result) && result.length === 0)
    ) {
        throw new Error(BOARD_ACCESS_DENIED);
    }
    return result;
}

export async function authorizeList(
    user: { id: string },
    listId: string,
    action: Action,
    includeDeleted = false,
) {
    const row = await db.query.lists.findFirst({
        where: and(
            eq(lists.id, listId),
            includeDeleted ? undefined : isNull(lists.deletedAt),
        ),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeBoard(user, row.boardId, action);
}

export async function authorizeCard(
    user: { id: string },
    cardId: string,
    action: Action,
    includeDeleted = false,
) {
    const row = await db.query.cards.findFirst({
        where: and(
            eq(cards.id, cardId),
            includeDeleted ? undefined : isNull(cards.deletedAt),
        ),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeList(user, row.listId, action);
}

export async function authorizeChecklist(
    user: { id: string },
    checklistId: string,
    action: Action,
) {
    const row = await db.query.checklists.findFirst({
        where: eq(checklists.id, checklistId),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeCard(user, row.cardId, action);
}

export async function authorizeChecklistItem(
    user: { id: string },
    itemId: string,
    action: Action,
) {
    const row = await db.query.checklistItems.findFirst({
        where: eq(checklistItems.id, itemId),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeChecklist(user, row.checklistId, action);
}

export async function authorizeLabel(
    user: { id: string },
    labelId: string,
    action: Action,
) {
    const row = await db.query.labels.findFirst({
        where: eq(labels.id, labelId),
    });
    if (!row) throw new Error(BOARD_ACCESS_DENIED);
    return authorizeBoard(user, row.boardId, action);
}
