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
        sql`truncate table "todos", "user" restart identity cascade`,
    );
}

export async function resetTodos() {
    await db.execute(sql`truncate table "todos" restart identity cascade`);
}
