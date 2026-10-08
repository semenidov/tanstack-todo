import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import { lists } from '#/db/schema';
import { createBoard, deleteList, getBoard } from '#/server/boards-repo';
import { seedUser } from '#/test/db';
import { asc, eq } from 'drizzle-orm';

const MIGRATION = 'drizzle/0011_flippant_stellaris.sql';

/** The backfill UPDATE of the migration, run as is on the current rows. */
async function runBackfill() {
    const statement = readFileSync(MIGRATION, 'utf8')
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .find((s) => s.startsWith('WITH ranked AS'));
    if (!statement) throw new Error(`No backfill statement in ${MIGRATION}`);
    // A static statement from the repo, no data in it: the query builder cannot
    // run a migration file, so it goes to the driver directly.
    await db.$client.query(statement);
}

async function seedBoardByCreatedAt(userId: string, n: number) {
    const board = await createBoard(userId, 'Board');
    const start = Date.now();
    // Keys in reverse order: only the backfill can put them in createdAt order.
    const rows = await db
        .insert(lists)
        .values(
            Array.from({ length: n }, (_, i) => ({
                boardId: board.id,
                title: `list ${i}`,
                position: `z${String(n - i).padStart(3, '0')}`,
                createdAt: new Date(start + i),
            })),
        )
        .returning();
    rows.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    return { board, ids: rows.map((r) => r.id) };
}

describe('lists.position backfill (migration 0011)', () => {
    it('keys every list of a board in createdAt order, deleted ones included', async () => {
        const a = await seedUser();
        const first = await seedBoardByCreatedAt(a.id, 3);
        const second = await seedBoardByCreatedAt(a.id, 2);
        await deleteList(a.id, first.ids[1]);

        await runBackfill();

        const rows = await db
            .select({ id: lists.id, position: lists.position })
            .from(lists)
            .where(eq(lists.boardId, first.board.id))
            .orderBy(asc(lists.createdAt));
        expect(rows).toEqual([
            { id: first.ids[0], position: 'a0' },
            { id: first.ids[1], position: 'a1' },
            { id: first.ids[2], position: 'a2' },
        ]);
        const visible = await getBoard(a.id, second.board.id);
        expect(visible?.lists.map((l) => [l.id, l.position])).toEqual([
            [second.ids[0], 'a0'],
            [second.ids[1], 'a1'],
        ]);
    });

    it('switches to two-character keys after 62 lists, still in order', async () => {
        const a = await seedUser();
        const { board, ids } = await seedBoardByCreatedAt(a.id, 64);

        await runBackfill();

        const result = await getBoard(a.id, board.id);
        expect(result?.lists.map((l) => l.id)).toEqual(ids);
        expect(result?.lists.slice(60).map((l) => l.position)).toEqual([
            'ay',
            'az',
            'b00',
            'b01',
        ]);
    });
});
