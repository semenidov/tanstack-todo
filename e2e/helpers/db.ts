import { generateNKeysBetween } from 'fractional-indexing';
import { and, eq, sql } from 'drizzle-orm';
import { user } from '../../src/db/auth-schema';
import { db } from '../../src/db';
import {
    boardMembers,
    boards,
    cards,
    lists,
    checklists,
    checklistItems,
    labels,
} from '../../src/db/schema';

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

/** Temporary fixture until users can join boards through invitations. */
export async function seedBoardMember(boardId: string, email: string) {
    const member = await db.query.user.findFirst({
        where: eq(user.email, email),
    });
    if (!member) throw new Error(`E2E: no user with email ${email}`);
    await db.insert(boardMembers).values({ boardId, userId: member.id });
}

export async function seedCards(
    boardId: string,
    listTitle: string,
    titles: string[],
) {
    const list = await db.query.lists.findFirst({
        where: and(eq(lists.boardId, boardId), eq(lists.title, listTitle)),
    });
    if (!list) throw new Error(`Missing fixture list ${listTitle}`);
    const positions = generateNKeysBetween(null, null, titles.length);
    return db
        .insert(cards)
        .values(
            titles.map((title, i) => ({
                listId: list.id,
                title,
                position: positions[i],
            })),
        )
        .returning();
}

export async function seedChecklist(cardId: string, titles: string[]) {
    const [checklist] = await db
        .insert(checklists)
        .values({ cardId, title: 'Steps' })
        .returning();
    const positions = generateNKeysBetween(null, null, titles.length);
    await db.insert(checklistItems).values(
        titles.map((title, i) => ({
            checklistId: checklist.id,
            title,
            position: positions[i],
        })),
    );
}

export async function seedLabels(boardId: string, titles: string[]) {
    return db
        .insert(labels)
        .values(titles.map((title) => ({ boardId, title, color: 'blue' })))
        .returning();
}
