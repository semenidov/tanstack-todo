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
    await db
        .update(cards)
        .set({ updatedAt: new Date() })
        .where(eq(cards.id, checklist.cardId));
    return checklist;
}

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

function keyBetween(
    prev: string | null,
    next: string | null,
): string | undefined {
    if (prev !== null && next !== null && prev >= next) return undefined;
    return generateKeyBetween(prev, next);
}

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

    let position = await findKey();
    if (position === undefined) {
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
