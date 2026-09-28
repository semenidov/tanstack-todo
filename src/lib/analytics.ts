const EDIT_TODO_PATH = /\/edit\/[^/?#]+/;
const BOARD_PATH = /\/b\/[^/?#]+/;
const CARD_PATH = /\/c\/[^/?#]+/;

export function normalizeAnalyticsUrl<T extends { url: string }>(event: T): T {
    return {
        ...event,
        url: event.url
            .replace(EDIT_TODO_PATH, '/edit/[todoId]')
            .replace(BOARD_PATH, '/b/[boardId]')
            .replace(CARD_PATH, '/c/[cardId]'),
    };
}
