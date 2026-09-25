const EDIT_TODO_PATH = /\/edit\/[^/?#]+/;

export function normalizeAnalyticsUrl<T extends { url: string }>(event: T): T {
    return { ...event, url: event.url.replace(EDIT_TODO_PATH, '/edit/[todoId]') };
}
