import { randomUUID } from 'node:crypto';
import { db } from '#/db';
import { todos, user } from '#/db/schema';

export async function seedUser(overrides: Partial<typeof user.$inferInsert> = {}) {
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

export async function seedTodo(
    userId: string,
    overrides: Partial<typeof todos.$inferInsert> = {},
) {
    const [row] = await db
        .insert(todos)
        .values({ name: 'task', isComplete: false, userId, ...overrides })
        .returning();
    return row;
}
