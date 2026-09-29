import { randomUUID } from 'node:crypto';
import { db } from '#/db';
import { user } from '#/db/schema';

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
