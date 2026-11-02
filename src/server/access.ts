import { db } from '#/db';
import { boardMembers, boards, cards, checklists, lists } from '#/db/schema';
import type { BoardAccess } from '#/server/authorize';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

export function accessibleBoardIds(userId: string) {
    return db
        .select({ id: boards.id })
        .from(boards)
        .where(
            or(
                eq(boards.ownerId, userId),
                inArray(
                    boards.id,
                    db
                        .select({ id: boardMembers.boardId })
                        .from(boardMembers)
                        .where(eq(boardMembers.userId, userId)),
                ),
            ),
        );
}

export function accessibleListIds(access: BoardAccess) {
    return db
        .select({ id: lists.id })
        .from(lists)
        .where(
            and(
                eq(lists.boardId, access.boardId),
                inArray(lists.boardId, accessibleBoardIds(access.userId)),
                isNull(lists.deletedAt),
            ),
        );
}
export function accessibleChecklistIds(access: BoardAccess) {
    return db
        .select({ id: checklists.id })
        .from(checklists)
        .where(inArray(checklists.cardId, accessibleCardIds(access)));
}
export function accessibleCardIds(access: BoardAccess) {
    return db
        .select({ id: cards.id })
        .from(cards)
        .where(
            and(
                inArray(cards.listId, accessibleListIds(access)),
                isNull(cards.deletedAt),
            ),
        );
}
export async function findAccessibleCard(access: BoardAccess, cardId: string) {
    const rows = await db
        .select({ id: cards.id, boardId: lists.boardId })
        .from(cards)
        .innerJoin(lists, eq(cards.listId, lists.id))
        .where(
            and(
                eq(cards.id, cardId),
                inArray(cards.id, accessibleCardIds(access)),
            ),
        );
    return rows.at(0);
}
export function scopedBoardIds(access: BoardAccess) {
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
