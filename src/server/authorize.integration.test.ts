import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import { boardMembers, boards, user } from '#/db/schema';
import { Action, Role } from '#/lib/permissions';
import { authorizeBoard, BOARD_ACCESS_DENIED } from './authorize';
import {
    addCard,
    addList,
    createBoard,
    deleteBoard,
    getBoard,
    listBoards,
    renameBoard,
} from './boards-repo';
import { createLabel, listLabels } from './labels-repo';
import { createChecklist, getChecklist } from './checklists-repo';
import { seedUser } from '#/test/db';
import { eq } from 'drizzle-orm';

async function sharedBoard() {
    const owner = await seedUser({ name: '<img src=x>' });
    const member = await seedUser();
    const outsider = await seedUser();
    const board = await createBoard(owner.id, 'Shared');
    await db
        .insert(boardMembers)
        .values({ boardId: board.id, userId: member.id });
    return { owner, member, outsider, board };
}

describe('board read authorization', () => {
    it('reads member content, labels and checklist without exposing the invite token', async () => {
        const { owner, member, outsider, board } = await sharedBoard();
        await db
            .update(boards)
            .set({ inviteToken: 'secret-test-token' })
            .where(eq(boards.id, board.id));
        const list = await addList(owner.id, board.id, 'List');
        if (!list) throw new Error('missing list');
        const card = await addCard(owner.id, list.id, 'Card');
        if (!card) throw new Error('missing card');
        await createChecklist(owner.id, card.id, 'Checklist');
        await createLabel(owner.id, board.id, { title: 'Label', color: 'red' });
        const access = await authorizeBoard(member, board.id, Action.BoardRead);
        expect(access.role).toBe(Role.Editor);
        const result = await getBoard(access);
        expect(result?.board.myRole).toBe(Role.Editor);
        expect(result?.board).not.toHaveProperty('inviteToken');
        expect(result?.lists[0].cards[0].title).toBe('Card');
        expect(await listLabels(access)).toHaveLength(1);
        expect((await getChecklist(member.id, card.id))?.title).toBe(
            'Checklist',
        );
        expect(await listBoards(member.id)).toEqual([
            expect.objectContaining({
                id: board.id,
                myRole: Role.Editor,
                ownerName: owner.name,
            }),
        ]);
        expect(await listBoards(outsider.id)).toEqual([]);
        expect((await listBoards(owner.id))[0].myRole).toBe(Role.Owner);
        await expect(
            authorizeBoard(outsider, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        for (const action of [
            Action.BoardRename,
            Action.BoardDelete,
            Action.MembersManage,
            Action.ListMoveToBoard,
        ]) {
            await expect(
                authorizeBoard(member, board.id, action),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
        }
        // Writes remain owner-only until they require passes in the next slice.
        expect(await renameBoard(member.id, board.id, 'Denied')).toEqual([]);
        expect(await deleteBoard(member.id, board.id)).toEqual([]);
        expect(await addList(member.id, board.id, 'Denied')).toBeNull();
        await db.delete(boardMembers).where(eq(boardMembers.userId, member.id));
        await expect(
            authorizeBoard(member, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        expect(await getBoard(access)).toBeNull();
        expect(await listLabels(access)).toEqual([]);
        expect(await getChecklist(member.id, card.id)).toBeNull();
    });

    it('enforces unique membership and cascades on deletion of member or board owner', async () => {
        const { owner, member, board } = await sharedBoard();
        await expect(
            db
                .insert(boardMembers)
                .values({ boardId: board.id, userId: member.id }),
        ).rejects.toThrow();
        await db.delete(user).where(eq(user.id, member.id));
        expect(await db.select().from(boardMembers)).toEqual([]);
        const other = await seedUser();
        await db
            .insert(boardMembers)
            .values({ boardId: board.id, userId: other.id });
        await db.delete(user).where(eq(user.id, owner.id));
        expect(await db.select().from(boardMembers)).toEqual([]);
        expect(await listBoards(other.id)).toEqual([]);
    });
});
