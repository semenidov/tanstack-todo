import { Action } from '#/lib/permissions';
import {
    authorizeBoard,
    authorizeList,
    authorizeCard,
    authorizeChecklist,
    requireChanged,
} from '#/server/authorize';
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

export async function addListAs(
    user: SessionUser,
    boardId: string,
    title: string,
) {
    return requireChanged(
        await repo.addList(
            await authorizeBoard(user.id, boardId, Action.ContentEdit),
            boardId,
            title,
            quotasFor(user),
        ),
    );
}

export async function restoreListAs(user: SessionUser, listId: string) {
    return requireChanged(
        await repo.restoreList(
            await authorizeList(user.id, listId, Action.ContentEdit, true),
            listId,
            quotasFor(user),
        ),
    );
}

export async function addCardAs(
    user: SessionUser,
    listId: string,
    title: string,
) {
    return requireChanged(
        await repo.addCard(
            await authorizeList(user.id, listId, Action.ContentEdit),
            listId,
            title,
            quotasFor(user),
        ),
    );
}

export async function restoreCardAs(user: SessionUser, cardId: string) {
    return requireChanged(
        await repo.restoreCard(
            await authorizeCard(user.id, cardId, Action.ContentEdit, true),
            cardId,
            quotasFor(user),
        ),
    );
}

export async function createLabelAs(
    user: SessionUser,
    boardId: string,
    input: LabelInput,
) {
    return requireChanged(
        await labelsRepo.createLabel(
            await authorizeBoard(user.id, boardId, Action.ContentEdit),
            boardId,
            input,
            quotasFor(user),
        ),
    );
}

export async function addCardLabelAs(
    user: SessionUser,
    cardId: string,
    labelId: string,
) {
    return requireChanged(
        await labelsRepo.addCardLabel(
            await authorizeCard(user.id, cardId, Action.ContentEdit),
            cardId,
            labelId,
            quotasFor(user),
        ),
    );
}

export async function addChecklistItemAs(
    user: SessionUser,
    checklistId: string,
    title: string,
) {
    return requireChanged(
        await checklistsRepo.addChecklistItem(
            await authorizeChecklist(user.id, checklistId, Action.ContentEdit),
            checklistId,
            title,
            quotasFor(user),
        ),
    );
}
