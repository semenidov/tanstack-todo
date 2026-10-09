import { db } from '#/db';
import { boards, cards, checklists, lists } from '#/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

// Ownership subqueries shared by the repos: an entity is the user's when its chain
// card → list → board leads to a board with owner_id = userId. Use them in
// `inArray(column, ownedXIds(userId))` so a write touches only the user's rows.

/** Boards of the user. */
export function ownedBoardIds(userId: string) {
    return db
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.ownerId, userId));
}

/** Live (not deleted) lists on the user's boards. */
export function ownedListIds(userId: string) {
    return db
        .select({ id: lists.id })
        .from(lists)
        .innerJoin(boards, eq(lists.boardId, boards.id))
        .where(and(eq(boards.ownerId, userId), isNull(lists.deletedAt)));
}

/** Live cards in live lists on the user's boards. */
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

/** Checklists of the user's live cards. */
export function ownedChecklistIds(userId: string) {
    return db
        .select({ id: checklists.id })
        .from(checklists)
        .where(inArray(checklists.cardId, ownedCardIds(userId)));
}

/**
 * A live card of the user with its board, or undefined: for writes that must stay
 * within the card's board (a label of another board can't go on the card).
 */
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
    // .at(0): a destructured [row] would be typed as always present.
    return rows.at(0);
}
