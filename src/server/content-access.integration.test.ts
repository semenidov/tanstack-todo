import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers, cards, lists } from '#/db/schema';
import { Action } from '#/lib/permissions';
import { seedBoardMember, seedUser } from '#/test/db';
import { authorizeCard } from './authorize';
import { createBoard, updateCard } from './boards-repo';

async function sharedCard() {
    const owner = await seedUser();
    const editor = await seedUser();
    const board = await createBoard(owner.id, 'Shared');
    const [list] = await db
        .insert(lists)
        .values({ boardId: board.id, title: 'Tasks', position: 'a0' })
        .returning();
    const [card] = await db
        .insert(cards)
        .values({ listId: list.id, title: 'Original', position: 'a0' })
        .returning();
    await seedBoardMember(board.id, editor.id);
    const access = await authorizeCard(editor.id, card.id, Action.ContentEdit);
    return { editor, card, access };
}

it('saves changes made by an editor on a shared board', async () => {
    const { card, access } = await sharedCard();

    await updateCard(access, card.id, {
        title: 'Renamed',
        description: 'Details',
    });

    expect(
        await db.query.cards.findFirst({ where: eq(cards.id, card.id) }),
    ).toMatchObject({ title: 'Renamed', description: 'Details' });
});

it('blocks an update with access issued before membership was revoked', async () => {
    const { editor, card, access } = await sharedCard();
    await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));

    expect(await updateCard(access, card.id, { title: 'Forbidden' })).toEqual(
        [],
    );
    expect(
        await db.query.cards.findFirst({ where: eq(cards.id, card.id) }),
    ).toMatchObject({ title: 'Original' });
});
