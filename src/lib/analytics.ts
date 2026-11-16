import { redactInviteTokens } from './invite-privacy';

const BOARD_PATH = /\/b\/[^/?#]+/;
const CARD_PATH = /\/c\/[^/?#]+/;

export function normalizeAnalyticsUrl<T extends { url: string }>(event: T): T {
    return {
        ...event,
        url: redactInviteTokens(event.url)
            .replace(BOARD_PATH, '/b/[boardId]')
            .replace(CARD_PATH, '/c/[cardId]'),
    };
}
