import { repoAccess } from '#/test/access';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers, boards, user } from '#/db/schema';
import { Action, BOARD_ACCESS_DENIED, Role } from '#/lib/permissions';
import { authorizeBoard, authorizeCard } from './authorize';
import {
    addCard,
    addList,
    createBoard,
    getBoard,
    listBoards,
} from './boards-repo';
import { createLabel, listLabels } from './labels-repo';
import {
    addChecklistItem,
    createChecklist,
    getChecklist,
} from './checklists-repo';
import { seedBoardMember, seedUser } from '#/test/db';

async function sharedBoard() {
    const owner = await seedUser();
    const editor = await seedUser();
    const board = await createBoard(owner.id, 'Shared');
    await seedBoardMember(board.id, editor.id);
    return { owner, editor, board };
}

describe('board read authorization', () => {
    it('owner and editor read all board content without token or member data', async () => {
        const { owner, editor, board } = await sharedBoard();
        const list = await addList(
            await repoAccess(owner.id, board.id),
            board.id,
            'Tasks',
        );
        if (!list) throw new Error('Missing list');
        const card = await addCard(
            await repoAccess(owner.id, list.id),
            list.id,
            'Task',
        );
        if (!card) throw new Error('Missing card');
        await createLabel(await repoAccess(owner.id, board.id), board.id, {
            title: 'Label',
            color: 'red',
        });
        const checklist = await createChecklist(
            await repoAccess(owner.id, card.id),
            card.id,
            'Checklist',
        );
        if (!checklist) throw new Error('Missing checklist');
        await addChecklistItem(
            await repoAccess(owner.id, checklist.id),
            checklist.id,
            'Item',
        );
        await db
            .update(boards)
            .set({ inviteToken: 'secret-token' })
            .where(eq(boards.id, board.id));
        for (const [person, role] of [
            [owner, Role.Owner],
            [editor, Role.Editor],
        ] as const) {
            const access = await authorizeBoard(
                person.id,
                board.id,
                Action.BoardRead,
            );
            expect(access.role).toBe(role);
            const result = await getBoard(access);
            expect(result?.board).toMatchObject({
                myRole: role,
                ownerName: owner.name,
            });
            expect(result?.board).not.toHaveProperty('inviteToken');
            expect(result?.board).not.toHaveProperty('members');
            expect(result?.lists[0].cards[0].title).toBe('Task');
            expect(await listLabels(access)).toHaveLength(1);
            expect(
                (
                    await getChecklist(
                        await authorizeCard(
                            person.id,
                            card.id,
                            Action.BoardRead,
                        ),
                        card.id,
                    )
                )?.items,
            ).toHaveLength(1);
        }
        expect(await listBoards(editor.id)).toEqual([
            expect.objectContaining({
                id: board.id,
                myRole: Role.Editor,
                ownerName: owner.name,
                listCount: 1,
                cardCount: 1,
            }),
        ]);
    });

    it('denies strangers, removed members, missing resources and owner actions by editors', async () => {
        const { owner, editor, board } = await sharedBoard();
        const stranger = await seedUser();
        await expect(
            authorizeBoard(stranger.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        expect(await listBoards(stranger.id)).toEqual([]);
        await expect(
            authorizeBoard(editor.id, board.id, Action.BoardRename),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        const stale = await authorizeBoard(
            editor.id,
            board.id,
            Action.BoardRead,
        );
        await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));
        expect(await getBoard(stale)).toBeNull();
        expect(await listLabels(stale)).toEqual([]);
        await expect(
            authorizeBoard(editor.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await db.delete(boards).where(eq(boards.id, board.id));
        await expect(
            authorizeBoard(owner.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            authorizeCard(owner.id, board.id, Action.BoardRead),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('enforces unique membership, unique non-null tokens and member cascades', async () => {
        const { owner, editor, board } = await sharedBoard();
        await expect(seedBoardMember(board.id, editor.id)).rejects.toThrow();
        const second = await createBoard(owner.id, 'Another');
        await db
            .update(boards)
            .set({ inviteToken: 'unique' })
            .where(eq(boards.id, board.id));
        await expect(
            db
                .update(boards)
                .set({ inviteToken: 'unique' })
                .where(eq(boards.id, second.id)),
        ).rejects.toThrow();
        await db.delete(user).where(eq(user.id, editor.id));
        expect(await db.select().from(boardMembers)).toEqual([]);
        const member = await seedUser();
        await seedBoardMember(board.id, member.id);
        await db.delete(user).where(eq(user.id, owner.id));
        expect(await db.select().from(boardMembers)).toEqual([]);
        expect(await listBoards(member.id)).toEqual([]);
    });
});
