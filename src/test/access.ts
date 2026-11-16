import { db } from '#/db';
import { boards } from '#/db/schema';
import { eq } from 'drizzle-orm';
import { Action } from '#/lib/permissions';
import { authorizeBoard } from '#/server/authorize';

// SQL isolation tests deliberately change the identity on a genuine pass: the
// repository must independently reject non-members, even after a successful gate.
export async function repoAccess(userId: string, boardId: string) {
    const board =
        (await db.query.boards.findFirst({ where: eq(boards.id, boardId) })) ??
        (await db.query.boards.findFirst());
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
        return { ...access, boardId };
    }
    return {
        ...(await authorizeBoard(board.ownerId, board.id, Action.ContentEdit)),
        userId,
        boardId,
    };
}
