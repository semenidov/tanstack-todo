import { eq, sql } from 'drizzle-orm';
import { user } from '../../src/db/auth-schema';
import { db } from '../../src/db';
import { boards, lists } from '../../src/db/schema';

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
    await db.insert(lists).values([
        { boardId: board.id, title: 'To do', position: 'a0' },
        { boardId: board.id, title: 'Done', position: 'a1' },
    ]);
    return board.id;
}

export async function resetBoards() {
    // Cascades to the board's lists and cards.
    await db.execute(sql`truncate table "boards" restart identity cascade`);
}
