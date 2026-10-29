import type { SessionUser } from '#/lib/auth-server';
import { quotasFor } from '#/lib/quotas';
import * as repo from '#/server/boards-repo';
import * as checklistsRepo from '#/server/checklists-repo';
import * as labelsRepo from '#/server/labels-repo';
import type { LabelInput } from '#/server/labels-repo';

// Passes the session user's quotas (the repo defaults to the regular ones).
// Import only inside server fn handlers, so the client build drops it.

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
        // The cookie cache (5 min) can outlive a deleted guest: the board insert hits
        // the FK, refuse it as unauthorized.
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

export function addChecklistItemAs(
    user: SessionUser,
    checklistId: string,
    title: string,
) {
    return checklistsRepo.addChecklistItem(
        user.id,
        checklistId,
        title,
        quotasFor(user),
    );
}
