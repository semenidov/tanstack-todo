import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import { boards, cards, lists } from '#/db/schema';
import { seedTodo, seedUser } from '#/test/db';

// Global setup (src/test/setup.integration.ts) truncates "todos" and "user"
// with cascade before each test, which also clears boards/lists/cards since
// boards.ownerId -> user.id cascades.
const migrationSql = readFileSync(
    path.join(process.cwd(), 'drizzle/0004_backfill_boards_from_todos.sql'),
    'utf-8',
);
const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

async function runBackfill() {
    for (const statement of statements) {
        await db.execute(sql.raw(statement));
    }
}

describe('backfill boards from todos', () => {
    it('creates one board, two lists and copies todos into the right list', async () => {
        const a = await seedUser();
        await seedTodo(a.id, { name: 'first', isComplete: false });
        await seedTodo(a.id, { name: 'second', isComplete: false });
        const done = await seedTodo(a.id, { name: 'third', isComplete: true });

        await runBackfill();

        const userBoards = await db
            .select()
            .from(boards)
            .where(eq(boards.ownerId, a.id));
        expect(userBoards).toHaveLength(1);
        expect(userBoards[0].title).toBe('My tasks');

        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, userBoards[0].id));
        expect(boardLists.map((l) => l.title).sort()).toEqual([
            'Done',
            'To do',
        ]);

        const todoList = boardLists.find((l) => l.title === 'To do')!;
        const doneList = boardLists.find((l) => l.title === 'Done')!;

        const todoCards = await db
            .select()
            .from(cards)
            .where(eq(cards.listId, todoList.id));
        const doneCards = await db
            .select()
            .from(cards)
            .where(eq(cards.listId, doneList.id));

        expect(todoCards).toHaveLength(2);
        expect(doneCards).toHaveLength(1);
        expect(doneCards[0].legacyTodoId).toBe(done.id);
        expect(doneCards[0].createdAt).toEqual(done.createdAt);
    });

    it('does not duplicate boards, lists or cards on a repeated run', async () => {
        const a = await seedUser();
        await seedTodo(a.id, { name: 'first', isComplete: false });
        await seedTodo(a.id, { name: 'second', isComplete: true });

        await runBackfill();
        await runBackfill();

        expect(
            await db.select().from(boards).where(eq(boards.ownerId, a.id)),
        ).toHaveLength(1);

        const userBoards = await db
            .select()
            .from(boards)
            .where(eq(boards.ownerId, a.id));
        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, userBoards[0].id));
        expect(boardLists).toHaveLength(2);

        let totalCards = 0;
        for (const list of boardLists) {
            const listCards = await db
                .select()
                .from(cards)
                .where(eq(cards.listId, list.id));
            totalCards += listCards.length;
        }
        expect(totalCards).toBe(2);
    });

    it('copies only the new todo added after the first run', async () => {
        const a = await seedUser();
        await seedTodo(a.id, { name: 'first', isComplete: false });

        await runBackfill();
        await seedTodo(a.id, { name: 'second', isComplete: false });
        await runBackfill();

        const userBoards = await db
            .select()
            .from(boards)
            .where(eq(boards.ownerId, a.id));
        const boardLists = await db
            .select()
            .from(lists)
            .where(eq(lists.boardId, userBoards[0].id));
        const todoList = boardLists.find((l) => l.title === 'To do')!;

        const todoCards = await db
            .select()
            .from(cards)
            .where(eq(cards.listId, todoList.id));
        expect(todoCards).toHaveLength(2);
    });

    it('does not create a board for a user without todos', async () => {
        const a = await seedUser();

        await runBackfill();

        expect(
            await db.select().from(boards).where(eq(boards.ownerId, a.id)),
        ).toHaveLength(0);
    });
});
