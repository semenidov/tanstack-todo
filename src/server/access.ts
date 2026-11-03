import { db } from '#/db';
import { boardMembers, boards, cards, checklists, lists } from '#/db/schema';
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

export function accessibleCardIds(userId: string, boardId: string) {
    return db
        .select({ id: cards.id })
        .from(cards)
        .innerJoin(lists, eq(cards.listId, lists.id))
        .where(
            and(
                eq(lists.boardId, boardId),
                inArray(lists.boardId, accessibleBoardIds(userId)),
                isNull(lists.deletedAt),
                isNull(cards.deletedAt),
            ),
        );
}

export function accessibleListIds(userId: string, boardId: string) {
    return db
        .select({ id: lists.id })
        .from(lists)
        .where(
            and(
                eq(lists.boardId, boardId),
                inArray(lists.boardId, accessibleBoardIds(userId)),
                isNull(lists.deletedAt),
            ),
        );
}
export function accessibleChecklistIds(userId: string, boardId: string) {
    return db
        .select({ id: checklists.id })
        .from(checklists)
        .where(inArray(checklists.cardId, accessibleCardIds(userId, boardId)));
}
export async function findAccessibleCard(
    userId: string,
    boardId: string,
    cardId: string,
) {
    const rows = await db
        .select({ id: cards.id, boardId: lists.boardId })
        .from(cards)
        .innerJoin(lists, eq(cards.listId, lists.id))
        .where(
            and(
                eq(cards.id, cardId),
                inArray(cards.id, accessibleCardIds(userId, boardId)),
            ),
        );
    return rows.at(0);
}
