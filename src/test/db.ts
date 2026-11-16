import { randomUUID } from 'node:crypto';
import { db } from '#/db';
import { boardMembers, boards, cards, lists, user } from '#/db/schema';
import { Action } from '#/lib/permissions';
import { authorizeBoard } from '#/server/authorize';

export async function seedUser(
    overrides: Partial<typeof user.$inferInsert> = {},
) {
    const id = randomUUID();
    const [row] = await db
        .insert(user)
        .values({
            id,
            name: 'Test User',
            email: `${id}@example.com`,
            ...overrides,
        })
        .returning();
    return row;
}

export async function seedBoardMember(boardId: string, userId: string) {
    await db.insert(boardMembers).values({ boardId, userId });
}

export type BoardFixtureOptions = {
    ownerId?: string;
    title?: string;
    action?: Action;
};

export async function seedBoardWithAccess({
    ownerId,
    title = 'Board',
    action = Action.ContentEdit,
}: BoardFixtureOptions = {}) {
    const userId = ownerId ?? (await seedUser()).id;
    const [board] = await db
        .insert(boards)
        .values({ ownerId: userId, title })
        .returning();
    const access = await authorizeBoard(userId, board.id, action);
    return { board, access };
}

export async function seedBoardWithCard(options?: BoardFixtureOptions) {
    const { board, access } = await seedBoardWithAccess(options);
    const [list] = await db
        .insert(lists)
        .values({ boardId: board.id, title: 'List', position: 'a0' })
        .returning();
    const [card] = await db
        .insert(cards)
        .values({ listId: list.id, title: 'Card', position: 'a0' })
        .returning();
    return { access, boardId: board.id, listId: list.id, cardId: card.id };
}
