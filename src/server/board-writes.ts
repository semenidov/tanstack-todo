import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';

// Bodies of the server fns that add a live row (create, restore; move is in
// move-card.ts). The repo functions default to the regular quotas, so the
// session user's quotas are passed here, in one place, and an integration test
// calls these functions for a guest (vitest has no Start runtime). Imported only
// inside server fn handlers: the client build drops it with them.

export function createBoardAs(user: SessionUser, title: string) {
    return repo.createBoard(user.id, title, quotasFor(user));
}

export function addListAs(user: SessionUser, boardId: string, title: string) {
    return repo.addList(user.id, boardId, title, quotasFor(user));
}

export function restoreListAs(user: SessionUser, listId: string) {
    return repo.restoreList(user.id, listId, quotasFor(user));
}

export function addCardAs(user: SessionUser, listId: string, title: string) {
    return repo.addCard(user.id, listId, title, quotasFor(user));
}

export function restoreCardAs(user: SessionUser, cardId: string) {
    return repo.restoreCard(user.id, cardId, quotasFor(user));
}
