import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers, boards, cards, lists, user } from '#/db/schema';
import { Action, BOARD_ACCESS_DENIED, Role } from '#/lib/permissions';
import { authorizeBoard, authorizeCard } from './authorize';
import { createBoard, getBoard } from './boards-repo';
import { seedBoardMember, seedUser } from '#/test/db';

async function sharedBoard() {
    const owner = await seedUser();
    const editor = await seedUser();
    const board = await createBoard(owner.id, 'Shared');
    await seedBoardMember(board.id, editor.id);
    return { owner, editor, board };
}

describe('board read authorization', () => {
    it('grants an editor read access to a card on their shared board', async () => {
        const { editor, board } = await sharedBoard();
        const [list] = await db
            .insert(lists)
            .values({ boardId: board.id, title: 'Tasks', position: 'a0' })
            .returning();
        const [card] = await db
            .insert(cards)
            .values({ listId: list.id, title: 'Task', position: 'a0' })
            .returning();

        expect(
            await authorizeCard(editor.id, card.id, Action.BoardRead),
        ).toMatchObject({
            userId: editor.id,
            boardId: board.id,
            role: Role.Editor,
        });
    });

    it('denies a stranger read access to the board', async () => {
        const { board } = await sharedBoard();
        const stranger = await seedUser();
        await expect(
            authorizeBoard(stranger.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('rejects a board read with access issued before membership was removed', async () => {
        const { editor, board } = await sharedBoard();
        const stale = await authorizeBoard(
            editor.id,
            board.id,
            Action.BoardRead,
        );
        await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));
        expect(await getBoard(stale)).toBeNull();
    });

    it('denies access to a deleted board', async () => {
        const { owner, board } = await sharedBoard();
        await db.delete(boards).where(eq(boards.id, board.id));
        await expect(
            authorizeBoard(owner.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('denies access to a missing card', async () => {
        const { owner, board } = await sharedBoard();
        await expect(
            authorizeCard(owner.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('enforces unique membership', async () => {
        const { editor, board } = await sharedBoard();
        await expect(seedBoardMember(board.id, editor.id)).rejects.toThrow();
    });

    it('deletes membership when the editor is deleted', async () => {
        const { editor } = await sharedBoard();
        await db.delete(user).where(eq(user.id, editor.id));
        expect(await db.select().from(boardMembers)).toEqual([]);
    });

    it('deletes membership when the board owner is deleted', async () => {
        const { owner } = await sharedBoard();
        await db.delete(user).where(eq(user.id, owner.id));
        expect(await db.select().from(boardMembers)).toEqual([]);
    });
});
