export interface CompletableTodo {
    isComplete: boolean;
}

export function countCompleted(
    todos: ReadonlyArray<CompletableTodo>,
): number {
    return todos.filter((todo) => todo.isComplete).length;
}

export function toggleInList<T extends { id: string; isComplete: boolean }>(
    todos: ReadonlyArray<T>,
    id: string,
    isComplete: boolean,
): Array<T> {
    return todos.map((todo) =>
        todo.id === id ? { ...todo, isComplete } : todo,
    );
}

export function removeFromList<T extends { id: string }>(
    todos: ReadonlyArray<T>,
    id: string,
): Array<T> {
    return todos.filter((todo) => todo.id !== id);
}
