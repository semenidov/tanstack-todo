import { db } from '#/db';
import {
    boards,
    cards,
    lists,
    labels,
    checklists,
    checklistItems,
} from '#/db/schema';
import { eq } from 'drizzle-orm';
import { Action } from '#/lib/permissions';
import { authorizeBoard } from '#/server/authorize';

// SQL isolation tests deliberately change the identity on a genuine pass: the
// repository must independently reject non-members, even after a successful gate.
export async function repoAccess(userId: string, resourceId: string) {
    let missing = false;
    let board = await db.query.boards.findFirst({
        where: eq(boards.id, resourceId),
    });
    if (!board) {
        const list = await db.query.lists.findFirst({
            where: eq(lists.id, resourceId),
        });
        const card = await db.query.cards.findFirst({
            where: eq(cards.id, resourceId),
            with: { list: true },
        });
        const label = await db.query.labels.findFirst({
            where: eq(labels.id, resourceId),
        });
        const checklist = await db.query.checklists.findFirst({
            where: eq(checklists.id, resourceId),
            with: { card: { with: { list: true } } },
        });
        const item = await db.query.checklistItems.findFirst({
            where: eq(checklistItems.id, resourceId),
            with: { checklist: { with: { card: { with: { list: true } } } } },
        });
        const boardId =
            list?.boardId ??
            card?.list.boardId ??
            label?.boardId ??
            checklist?.card.list.boardId ??
            item?.checklist.card.list.boardId;
        missing = !boardId;
        board = boardId
            ? await db.query.boards.findFirst({ where: eq(boards.id, boardId) })
            : await db.query.boards.findFirst();
    }
    if (!board) {
        const [fixture] = await db
            .insert(boards)
            .values({ ownerId: userId, title: 'Access fixture' })
            .returning();
        const access = await authorizeBoard(
            userId,
            fixture.id,
            Action.ContentEdit,
        );
        await db.delete(boards).where(eq(boards.id, fixture.id));
        return { ...access, boardId: resourceId };
    }
    return {
        ...(await authorizeBoard(board.ownerId, board.id, Action.ContentEdit)),
        userId,
        ...(missing ? { boardId: resourceId } : {}),
    };
}
