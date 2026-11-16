import { expect, it } from 'vitest';
import { db } from '#/db';
import { boards, lists } from '#/db/schema';
import { Action, Role } from '#/lib/permissions';
import { seedBoardMember, seedUser } from '#/test/db';
import { authorizeBoard } from './authorize';
import { getBoard, listBoards } from './boards-repo';

async function sharedBoard() {
    const owner = await seedUser({ name: 'Board owner' });
    const editor = await seedUser();
    const [board] = await db
        .insert(boards)
        .values({
            ownerId: owner.id,
            title: 'Shared',
            inviteToken: 'secret-token',
        })
        .returning();
    await seedBoardMember(board.id, editor.id);
    return { owner, editor, board };
}

it('lists a shared board with the editor role and owner name', async () => {
    const { owner, editor, board } = await sharedBoard();
    await db
        .insert(lists)
        .values({ boardId: board.id, title: 'Tasks', position: 'a0' });

    expect(await listBoards(editor.id)).toEqual([
        expect.objectContaining({
            id: board.id,
            myRole: Role.Editor,
            ownerName: owner.name,
            listCount: 1,
            cardCount: 0,
        }),
    ]);
});

it('omits the invite token and membership data from an editor’s board response', async () => {
    const { editor, board } = await sharedBoard();
    const access = await authorizeBoard(editor.id, board.id, Action.BoardRead);
    const result = await getBoard(access);

    expect(result?.board).toMatchObject({ id: board.id, myRole: Role.Editor });
    expect(result?.board).not.toHaveProperty('inviteToken');
    expect(result?.board).not.toHaveProperty('members');
});
