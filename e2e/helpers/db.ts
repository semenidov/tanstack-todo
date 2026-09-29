import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';

const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error('E2E: DATABASE_URL is not set (missing .env.e2e?)');
}

const db = drizzle(neon(url));

export async function resetDb() {
    await db.execute(
        sql`truncate table "todos", "boards", "user" restart identity cascade`,
    );
}

export async function resetBoards() {
    // Cascades to the board's lists and cards.
    await db.execute(sql`truncate table "boards" restart identity cascade`);
}
