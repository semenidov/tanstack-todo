import { neon } from '@neondatabase/serverless';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { user } from '../../src/db/auth-schema';
import { boards, lists } from '../../src/db/schema';

const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error('E2E: DATABASE_URL is not set (missing .env.e2e?)');
}

const db = drizzle(neon(url));

// `sql` only for truncate: the query builder has no truncate.
export async function resetDb() {
    await db.execute(
        sql`truncate table "boards", "user" restart identity cascade`,
    );
}

/** Inserts a board with «To do» and «Done» lists for the user; returns its id. */
export async function seedBoard(email: string, title = 'My tasks') {
    const owners = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email));
    const owner = owners.at(0);
    if (!owner) throw new Error(`E2E: no user with email ${email}`);

    const [board] = await db
        .insert(boards)
        .values({ ownerId: owner.id, title })
        .returning({ id: boards.id });
    // Explicit createdAt keeps list order stable.
    const now = Date.now();
    await db.insert(lists).values([
        { boardId: board.id, title: 'To do', createdAt: new Date(now) },
        { boardId: board.id, title: 'Done', createdAt: new Date(now + 1) },
    ]);
    return board.id;
}

export async function resetBoards() {
    // Cascades to the board's lists and cards.
    await db.execute(sql`truncate table "boards" restart identity cascade`);
}
