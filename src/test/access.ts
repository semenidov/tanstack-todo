import { db } from '#/db';
import {
    boards,
    cards,
    lists,
    labels,
    checklists,
    checklistItems,
} from '#/db/schema';
import { authorizeBoard } from '#/server/authorize';
import { Action } from '#/lib/permissions';
import { and, eq, inArray } from 'drizzle-orm';
import { accessibleBoardIds } from '#/server/access';

// Use a real pass; foreign/missing resources get a pass for an unrelated own board
// so the repository's independent SQL restrictions are still exercised.
export async function testAccess(userId: string, resourceId: string) {
    const resourceBoards = db
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.id, resourceId))
        .union(
            db
                .select({ id: lists.boardId })
                .from(lists)
                .where(eq(lists.id, resourceId)),
        )
        .union(
            db
                .select({ id: lists.boardId })
                .from(cards)
                .innerJoin(lists, eq(cards.listId, lists.id))
                .where(eq(cards.id, resourceId)),
        )
        .union(
            db
                .select({ id: labels.boardId })
                .from(labels)
                .where(eq(labels.id, resourceId)),
        )
        .union(
            db
                .select({ id: lists.boardId })
                .from(checklists)
                .innerJoin(cards, eq(checklists.cardId, cards.id))
                .innerJoin(lists, eq(cards.listId, lists.id))
                .where(eq(checklists.id, resourceId)),
        )
        .union(
            db
                .select({ id: lists.boardId })
                .from(checklistItems)
                .innerJoin(
                    checklists,
                    eq(checklistItems.checklistId, checklists.id),
                )
                .innerJoin(cards, eq(checklists.cardId, cards.id))
                .innerJoin(lists, eq(cards.listId, lists.id))
                .where(eq(checklistItems.id, resourceId)),
        );
    const rows = await db
        .select({ id: boards.id })
        .from(boards)
        .where(
            and(
                inArray(boards.id, accessibleBoardIds(userId)),
                inArray(boards.id, resourceBoards),
            ),
        );
    let boardId = rows.at(0)?.id;
    if (!boardId) {
        const own = await db.query.boards.findFirst({
            where: eq(boards.ownerId, userId),
        });
        boardId = own?.id;
    }
    if (!boardId) {
        const [board] = await db
            .insert(boards)
            .values({ ownerId: userId, title: 'Access test' })
            .returning();
        boardId = board.id;
    }
    return authorizeBoard({ id: userId }, boardId, Action.BoardRead);
}
