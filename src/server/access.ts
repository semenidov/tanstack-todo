import { db } from '#/db';
import { boards, cards, checklists, lists } from '#/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

export function ownedBoardIds(userId: string) {
    return db
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.ownerId, userId));
}

export function ownedListIds(userId: string) {
    return db
        .select({ id: lists.id })
        .from(lists)
        .innerJoin(boards, eq(lists.boardId, boards.id))
        .where(and(eq(boards.ownerId, userId), isNull(lists.deletedAt)));
}

export function ownedCardIds(userId: string) {
    return db
        .select({ id: cards.id })
        .from(cards)
        .where(
            and(
                inArray(cards.listId, ownedListIds(userId)),
                isNull(cards.deletedAt),
            ),
        );
}

export function ownedChecklistIds(userId: string) {
    return db
        .select({ id: checklists.id })
        .from(checklists)
        .where(inArray(checklists.cardId, ownedCardIds(userId)));
}

export async function findOwnedCard(userId: string, cardId: string) {
    const rows = await db
        .select({ id: cards.id, boardId: lists.boardId })
        .from(cards)
        .innerJoin(lists, eq(cards.listId, lists.id))
        .innerJoin(boards, eq(lists.boardId, boards.id))
        .where(
            and(
                eq(cards.id, cardId),
                isNull(cards.deletedAt),
                isNull(lists.deletedAt),
                eq(boards.ownerId, userId),
            ),
        );
    // .at(0): destructuring [row] would be typed as always present.
    return rows.at(0);
}
