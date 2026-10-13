import { db } from '#/db';
import { cards, checklistItems, checklists } from '#/db/schema';
import { QuotaExceededError, QuotaKind, USER_QUOTAS } from '#/lib/quotas';
import type { Quotas } from '#/lib/quotas';
import {
    findOwnedCard,
    ownedCardIds,
    ownedChecklistIds,
} from '#/server/access';
import { and, asc, count, eq, inArray, max } from 'drizzle-orm';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

// The checklist of a card and its items (#120). Access by the chain checklist →
// card → list → board → owner (access.ts). Checklists and items are deleted for
// real (FK cascade); a soft-deleted card keeps its checklist for Undo. Every edit
// bumps the card's updated_at: it is an edit of the card.

/** Bumps updated_at of the checklist's card. */
function touchChecklistCard(checklistId: string) {
    return db
        .update(cards)
        .set({ updatedAt: new Date() })
        .where(
            inArray(
                cards.id,
                db
                    .select({ id: checklists.cardId })
                    .from(checklists)
                    .where(eq(checklists.id, checklistId)),
            ),
        );
}

/** The checklist of the user's live card with items in order, or null. */
export async function getChecklist(userId: string, cardId: string) {
    const checklist = await db.query.checklists.findFirst({
        where: and(
            eq(checklists.cardId, cardId),
            inArray(checklists.cardId, ownedCardIds(userId)),
        ),
        with: {
            items: {
                orderBy: [asc(checklistItems.position), asc(checklistItems.id)],
            },
        },
    });
    return checklist ?? null;
}

/** Null when the card is not the user's or already has a checklist (one per card). */
export async function createChecklist(
    userId: string,
    cardId: string,
    title: string,
) {
    const card = await findOwnedCard(userId, cardId);
    if (!card) return null;
    const rows = await db
        .insert(checklists)
        .values({ cardId, title })
        .onConflictDoNothing({ target: checklists.cardId })
        .returning();
    const checklist = rows.at(0);
    if (!checklist) return null;
    await touchChecklistCard(checklist.id);
    return { ...checklist, items: [] };
}

export async function renameChecklist(
    userId: string,
    checklistId: string,
    title: string,
) {
    const rows = await db
        .update(checklists)
        .set({ title })
        .where(
            and(
                eq(checklists.id, checklistId),
                inArray(checklists.id, ownedChecklistIds(userId)),
            ),
        )
        .returning();
    const checklist = rows.at(0);
    if (!checklist) return null;
    await touchChecklistCard(checklist.id);
    return checklist;
}

/** Deletes the checklist with its items (FK cascade). */
export async function deleteChecklist(userId: string, checklistId: string) {
    const rows = await db
        .delete(checklists)
        .where(
            and(
                eq(checklists.id, checklistId),
                inArray(checklists.id, ownedChecklistIds(userId)),
            ),
        )
        .returning();
    const checklist = rows.at(0);
    if (!checklist) return null;
    // By the card id: the checklist row is gone.
    await db
        .update(cards)
        .set({ updatedAt: new Date() })
        .where(eq(cards.id, checklist.cardId));
    return checklist;
}

// Item order: `position` is a fractional-indexing key compared byte-wise
// (COLLATE "C"), ties broken by id; keys are made only here (ADR 58).

/** Adds an item last. Null when the checklist is not the user's. */
export async function addChecklistItem(
    userId: string,
    checklistId: string,
    title: string,
    quotas: Quotas = USER_QUOTAS,
) {
    const owned = await db
        .select({ id: checklists.id })
        .from(checklists)
        .where(
            and(
                eq(checklists.id, checklistId),
                inArray(checklists.id, ownedChecklistIds(userId)),
            ),
        );
    if (owned.length === 0) return null;
    // An aggregate always returns one row; max is null for an empty checklist.
    const [stats] = await db
        .select({ n: count(), last: max(checklistItems.position) })
        .from(checklistItems)
        .where(eq(checklistItems.checklistId, checklistId));
    const limit = quotas[QuotaKind.ChecklistItems];
    if (stats.n >= limit) {
        throw new QuotaExceededError(QuotaKind.ChecklistItems, limit);
    }
    const [item] = await db
        .insert(checklistItems)
        .values({
            checklistId,
            title,
            position: generateKeyBetween(stats.last, null),
        })
        .returning();
    await touchChecklistCard(checklistId);
    return item;
}

/** The user's item, by the chain item → checklist → card → board. */
function ownedItem(userId: string, itemId: string) {
    return and(
        eq(checklistItems.id, itemId),
        inArray(checklistItems.checklistId, ownedChecklistIds(userId)),
    );
}

export async function updateChecklistItem(
    userId: string,
    itemId: string,
    patch: { title?: string; done?: boolean },
) {
    const rows = await db
        .update(checklistItems)
        .set(patch)
        .where(ownedItem(userId, itemId))
        .returning();
    const item = rows.at(0);
    if (!item) return null;
    await touchChecklistCard(item.checklistId);
    return item;
}

export async function deleteChecklistItem(userId: string, itemId: string) {
    const rows = await db
        .delete(checklistItems)
        .where(ownedItem(userId, itemId))
        .returning();
    const item = rows.at(0);
    if (!item) return null;
    await touchChecklistCard(item.checklistId);
    return item;
}

/** Keys of the neighbors in the checklist, or undefined if one is missing there. */
async function readNeighbors(checklistId: string, neighborIds: string[]) {
    if (neighborIds.length === 0) return new Map<string, string>();
    const rows = await db
        .select({ id: checklistItems.id, position: checklistItems.position })
        .from(checklistItems)
        .where(
            and(
                eq(checklistItems.checklistId, checklistId),
                inArray(checklistItems.id, neighborIds),
            ),
        );
    if (rows.length !== new Set(neighborIds).size) return undefined;
    return new Map(rows.map((r) => [r.id, r.position]));
}

/**
 * Gives every item a fresh key in the current order. Sequential updates without
 * a transaction (ADR 22): a rare path, the next renumbering fixes a partial failure.
 */
async function renumberChecklist(checklistId: string) {
    const rows = await db
        .select({ id: checklistItems.id })
        .from(checklistItems)
        .where(eq(checklistItems.checklistId, checklistId))
        .orderBy(asc(checklistItems.position), asc(checklistItems.id));
    const keys = generateNKeysBetween(null, null, rows.length);
    for (const [i, row] of rows.entries()) {
        await db
            .update(checklistItems)
            .set({ position: keys[i] })
            .where(eq(checklistItems.id, row.id));
    }
}

/** Key strictly between the neighbors, or undefined if their keys are not ordered. */
function keyBetween(
    prev: string | null,
    next: string | null,
): string | undefined {
    if (prev !== null && next !== null && prev >= next) return undefined;
    return generateKeyBetween(prev, next);
}

/**
 * Puts the item between its new neighbors (null - the start or the end). Null
 * when the item is not the user's or the neighbors are not in its checklist or
 * not in this order (the client saw a stale list).
 */
export async function moveChecklistItem(
    userId: string,
    itemId: string,
    prevItemId: string | null,
    nextItemId: string | null,
) {
    if (prevItemId === itemId || nextItemId === itemId) return null;
    if (prevItemId !== null && prevItemId === nextItemId) return null;
    const owned = await db
        .select({ checklistId: checklistItems.checklistId })
        .from(checklistItems)
        .where(ownedItem(userId, itemId));
    const checklistId = owned.at(0)?.checklistId;
    if (!checklistId) return null;

    const neighborIds = [prevItemId, nextItemId].filter((id) => id !== null);
    const findKey = async () => {
        const neighbors = await readNeighbors(checklistId, neighborIds);
        if (!neighbors) return null;
        const positionOf = (id: string | null) =>
            id === null ? null : (neighbors.get(id) ?? null);
        return keyBetween(positionOf(prevItemId), positionOf(nextItemId));
    };

    // null - a neighbor is not in the checklist; undefined - keys out of order.
    let position = await findKey();
    if (position === undefined) {
        // Equal keys (two tabs added at once): renumber and try once more.
        await renumberChecklist(checklistId);
        position = await findKey();
    }
    if (position === null || position === undefined) return null;

    const rows = await db
        .update(checklistItems)
        .set({ position })
        .where(eq(checklistItems.id, itemId))
        .returning();
    await touchChecklistCard(checklistId);
    return rows.at(0) ?? null;
}
