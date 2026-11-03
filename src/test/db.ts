import { randomUUID } from 'node:crypto';
import { db } from '#/db';
import { boardMembers, user } from '#/db/schema';

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
