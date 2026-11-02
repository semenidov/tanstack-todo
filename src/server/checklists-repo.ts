import type { BoardAccess } from '#/server/authorize';
import { db } from '#/db';
import { cards, checklistItems, checklists } from '#/db/schema';
import { QuotaExceededError, QuotaKind, USER_QUOTAS } from '#/lib/quotas';
import type { Quotas } from '#/lib/quotas';
import {
    accessibleCardIds,
    findAccessibleCard,
    accessibleChecklistIds,
} from '#/server/access';
import { and, asc, count, eq, inArray, max, sql } from 'drizzle-orm';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

function touchChecklistCard(access: BoardAccess, checklistId: string) {
    return db
        .update(cards)
        .set({ updatedAt: new Date() })
        .where(
            inArray(
                cards.id,
                db
                    .select({ id: checklists.cardId })
                    .from(checklists)
                    .where(
                        and(
                            eq(checklists.id, checklistId),
                            inArray(
                                checklists.id,
                                accessibleChecklistIds(access),
                            ),
                        ),
                    ),
            ),
        );
}

export async function getChecklist(access: BoardAccess, cardId: string) {
    const checklist = await db.query.checklists.findFirst({
        where: and(
            eq(checklists.cardId, cardId),
            inArray(checklists.cardId, accessibleCardIds(access)),
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
    access: BoardAccess,
    cardId: string,
    title: string,
) {
    const card = await findAccessibleCard(access, cardId);
    if (!card) return null;
    const rows = await db
        .insert(checklists)
        .select(
            db
                .select({
                    id: sql<string>`gen_random_uuid()`.as('id'),
                    cardId: cards.id,
                    title: sql<string>`${title}`.as('title'),
                    createdAt: sql<Date>`now()`.as('created_at'),
                })
                .from(cards)
                .where(
                    and(
                        eq(cards.id, cardId),
                        inArray(cards.id, accessibleCardIds(access)),
                    ),
                ),
        )
        .onConflictDoNothing({ target: checklists.cardId })
        .returning();
    const checklist = rows.at(0);
    if (!checklist) return null;
    await touchChecklistCard(access, checklist.id);
    return { ...checklist, items: [] };
}

export async function renameChecklist(
    access: BoardAccess,
    checklistId: string,
    title: string,
) {
    const rows = await db
        .update(checklists)
        .set({ title })
        .where(
            and(
                eq(checklists.id, checklistId),
                inArray(checklists.id, accessibleChecklistIds(access)),
            ),
        )
        .returning();
    const checklist = rows.at(0);
    if (!checklist) return null;
    await touchChecklistCard(access, checklist.id);
    return checklist;
}

export async function deleteChecklist(
    access: BoardAccess,
    checklistId: string,
) {
    const rows = await db
        .delete(checklists)
        .where(
            and(
                eq(checklists.id, checklistId),
                inArray(checklists.id, accessibleChecklistIds(access)),
            ),
        )
        .returning();
    const checklist = rows.at(0);
    if (!checklist) return null;
    await db
        .update(cards)
        .set({ updatedAt: new Date() })
        .where(
            and(
                eq(cards.id, checklist.cardId),
                inArray(cards.id, accessibleCardIds(access)),
            ),
        );
    return checklist;
}

export async function addChecklistItem(
    access: BoardAccess,
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
                inArray(checklists.id, accessibleChecklistIds(access)),
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
        .select(
            db
                .select({
                    id: sql<string>`gen_random_uuid()`.as('id'),
                    checklistId: checklists.id,
                    title: sql<string>`${title}`.as('title'),
                    done: sql<boolean>`false`.as('done'),
                    position:
                        sql<string>`${generateKeyBetween(stats.last, null)}`.as(
                            'position',
                        ),
                    createdAt: sql<Date>`now()`.as('created_at'),
                })
                .from(checklists)
                .where(
                    and(
                        eq(checklists.id, checklistId),
                        inArray(checklists.id, accessibleChecklistIds(access)),
                    ),
                ),
        )
        .returning();
    await touchChecklistCard(access, checklistId);
    return item;
}

function accessibleItem(access: BoardAccess, itemId: string) {
    return and(
        eq(checklistItems.id, itemId),
        inArray(checklistItems.checklistId, accessibleChecklistIds(access)),
    );
}

export async function updateChecklistItem(
    access: BoardAccess,
    itemId: string,
    patch: { title?: string; done?: boolean },
) {
    const rows = await db
        .update(checklistItems)
        .set(patch)
        .where(accessibleItem(access, itemId))
        .returning();
    const item = rows.at(0);
    if (!item) return null;
    await touchChecklistCard(access, item.checklistId);
    return item;
}

export async function deleteChecklistItem(access: BoardAccess, itemId: string) {
    const rows = await db
        .delete(checklistItems)
        .where(accessibleItem(access, itemId))
        .returning();
    const item = rows.at(0);
    if (!item) return null;
    await touchChecklistCard(access, item.checklistId);
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

async function renumberChecklist(access: BoardAccess, checklistId: string) {
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
            .where(accessibleItem(access, row.id));
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
    access: BoardAccess,
    itemId: string,
    prevItemId: string | null,
    nextItemId: string | null,
) {
    if (prevItemId === itemId || nextItemId === itemId) return null;
    if (prevItemId !== null && prevItemId === nextItemId) return null;
    const owned = await db
        .select({ checklistId: checklistItems.checklistId })
        .from(checklistItems)
        .where(accessibleItem(access, itemId));
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
        await renumberChecklist(access, checklistId);
        position = await findKey();
    }
    if (position === null || position === undefined) return null;

    const rows = await db
        .update(checklistItems)
        .set({ position })
        .where(accessibleItem(access, itemId))
        .returning();
    await touchChecklistCard(access, checklistId);
    return rows.at(0) ?? null;
}
