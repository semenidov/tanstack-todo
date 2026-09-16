export interface CompletableTodo {
    isComplete: boolean;
}

export function countCompleted(
    todos: ReadonlyArray<CompletableTodo>,
): number {
    return todos.filter((todo) => todo.isComplete).length;
}
