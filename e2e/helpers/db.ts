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
        sql`truncate table "boards", "user" restart identity cascade`,
    );
}

/** Inserts a board with «To do» and «Done» lists for the user; returns its id. */
export async function seedBoard(email: string, title = 'My tasks') {
    const boardId = crypto.randomUUID();
    const now = Date.now();
    // Explicit createdAt keeps list order stable, as in `createBoard`.
    await db.execute(sql`
        with u as (select id from "user" where email = ${email}),
        b as (
            insert into "boards" (id, owner_id, title)
            select ${boardId}::uuid, u.id, ${title} from u
            returning id
        )
        insert into "lists" (board_id, title, "createdAt")
        select b.id, l.title, l."createdAt"
        from b, (values
            ('To do', ${new Date(now).toISOString()}::timestamptz),
            ('Done', ${new Date(now + 1).toISOString()}::timestamptz)
        ) as l(title, "createdAt")
    `);
    return boardId;
}

export async function resetBoards() {
    // Cascades to the board's lists and cards.
    await db.execute(sql`truncate table "boards" restart identity cascade`);
}
