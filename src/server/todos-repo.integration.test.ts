import { describe, expect, it } from 'vitest';
import {
    addTodo,
    deleteTodo,
    getTodo,
    listTodos,
    toggleTodo,
    updateTodo,
} from '#/server/todos-repo';
import { seedTodo, seedUser } from '#/test/db';

describe('todos-repo scoping', () => {
    it('lists only the owner tasks', async () => {
        const a = await seedUser();
        const b = await seedUser();
        await seedTodo(a.id, { name: 'a task' });
        await seedTodo(b.id, { name: 'b task' });

        const list = await listTodos(a.id);
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('a task');
    });

    it('addTodo stores the owner id', async () => {
        const a = await seedUser();
        const row = await addTodo(a.id, 'new task');
        expect(row.userId).toBe(a.id);
        expect(row.isComplete).toBe(false);
    });

    it('getTodo returns null for another user task', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const todo = await seedTodo(a.id);

        expect(await getTodo(b.id, todo.id)).toBeNull();
        expect(await getTodo(a.id, todo.id)).not.toBeNull();
    });

    it('toggleTodo is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const todo = await seedTodo(a.id, { isComplete: false });

        const affected = await toggleTodo(b.id, todo.id, true);
        expect(affected).toHaveLength(0);
        expect((await getTodo(a.id, todo.id))?.isComplete).toBe(false);
    });

    it('toggleTodo updates the owner task', async () => {
        const a = await seedUser();
        const todo = await seedTodo(a.id, { isComplete: false });

        const affected = await toggleTodo(a.id, todo.id, true);
        expect(affected).toHaveLength(1);
        expect((await getTodo(a.id, todo.id))?.isComplete).toBe(true);
    });

    it('deleteTodo is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const todo = await seedTodo(a.id);

        const affected = await deleteTodo(b.id, todo.id);
        expect(affected).toHaveLength(0);
        expect(await getTodo(a.id, todo.id)).not.toBeNull();
    });

    it('deleteTodo removes the owner task', async () => {
        const a = await seedUser();
        const todo = await seedTodo(a.id);

        await deleteTodo(a.id, todo.id);
        expect(await getTodo(a.id, todo.id)).toBeNull();
    });

    it('updateTodo is a no-op for another user', async () => {
        const a = await seedUser();
        const b = await seedUser();
        const todo = await seedTodo(a.id, { name: 'original' });

        const affected = await updateTodo(b.id, todo.id, 'hacked');
        expect(affected).toHaveLength(0);
        expect((await getTodo(a.id, todo.id))?.name).toBe('original');
    });

    it('updateTodo renames the owner task', async () => {
        const a = await seedUser();
        const todo = await seedTodo(a.id, { name: 'original' });

        await updateTodo(a.id, todo.id, 'renamed');
        expect((await getTodo(a.id, todo.id))?.name).toBe('renamed');
    });
});

describe('todos-repo edge cases', () => {
    const MISSING_ID = '00000000-0000-0000-0000-000000000000';

    it('listTodos returns an empty array for a user with no tasks', async () => {
        const a = await seedUser();
        expect(await listTodos(a.id)).toEqual([]);
    });

    it('listTodos orders tasks by createdAt ascending', async () => {
        const a = await seedUser();
        await seedTodo(a.id, {
            name: 'newer',
            createdAt: new Date('2024-01-02T00:00:00Z'),
        });
        await seedTodo(a.id, {
            name: 'older',
            createdAt: new Date('2024-01-01T00:00:00Z'),
        });

        const list = await listTodos(a.id);
        expect(list.map((t) => t.name)).toEqual(['older', 'newer']);
    });

    it('getTodo returns null for a non-existent id', async () => {
        const a = await seedUser();
        expect(await getTodo(a.id, MISSING_ID)).toBeNull();
    });

    it('toggleTodo and updateTodo are no-ops for a non-existent id', async () => {
        const a = await seedUser();
        expect(await toggleTodo(a.id, MISSING_ID, true)).toHaveLength(0);
        expect(await updateTodo(a.id, MISSING_ID, 'x')).toHaveLength(0);
        expect(await deleteTodo(a.id, MISSING_ID)).toHaveLength(0);
    });
});
