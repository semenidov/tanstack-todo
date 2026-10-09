import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';
import * as labelsRepo from '#/server/labels-repo';
import type { LabelInput } from '#/server/labels-repo';

// Bodies of the server fns that add a live row (create, restore; move is in
// move-card.ts). The repo functions default to the regular quotas, so the
// session user's quotas are passed here, in one place, and an integration test
// calls these functions for a guest (vitest has no Start runtime). Imported only
// inside server fn handlers: the client build drops it with them.

/** Postgres foreign_key_violation, anywhere in the cause chain (drizzle wraps the driver error). */
function isForeignKeyViolation(error: unknown): boolean {
    for (let e = error; e instanceof Error; e = e.cause) {
        if ('code' in e && e.code === '23503') return true;
    }
    return false;
}

export async function createBoardAs(user: SessionUser, title: string) {
    try {
        return await repo.createBoard(user.id, title, quotasFor(user));
    } catch (error) {
        // The session cookie cache (5 min) can outlive a deleted user (an
        // expired guest, a guest signed out in another tab). The board insert
        // is the one write without an owned row to check first, so it hits the
        // FK: refuse it as unauthorized, without the SQL text. Caught here, not
        // checked in requireUser: no extra query on every server fn.
        if (isForeignKeyViolation(error)) throw new Error('Unauthorized');
        throw error;
    }
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

export function createLabelAs(
    user: SessionUser,
    boardId: string,
    input: LabelInput,
) {
    return labelsRepo.createLabel(user.id, boardId, input, quotasFor(user));
}

export function addCardLabelAs(
    user: SessionUser,
    cardId: string,
    labelId: string,
) {
    return labelsRepo.addCardLabel(user.id, cardId, labelId, quotasFor(user));
}
