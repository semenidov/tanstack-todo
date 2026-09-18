import { db } from '#/db';
import { todos } from '#/db/schema';
import { and, eq } from 'drizzle-orm';

export function listTodos(userId: string) {
    return db.query.todos.findMany({
        where: (t) => eq(t.userId, userId),
        orderBy: (t, { asc }) => asc(t.createdAt),
    });
}

export async function getTodo(userId: string, id: string) {
    const todo = await db.query.todos.findFirst({
        where: (t) => and(eq(t.id, id), eq(t.userId, userId)),
    });
    return todo ?? null;
}

export async function addTodo(userId: string, name: string) {
    const [row] = await db
        .insert(todos)
        .values({ name, isComplete: false, userId })
        .returning();
    return row;
}

export function toggleTodo(userId: string, id: string, isComplete: boolean) {
    return db
        .update(todos)
        .set({ isComplete })
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning();
}

export function deleteTodo(userId: string, id: string) {
    return db
        .delete(todos)
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning();
}

export function updateTodo(userId: string, id: string, name: string) {
    return db
        .update(todos)
        .set({ name })
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning();
}
