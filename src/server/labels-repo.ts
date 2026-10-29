import { db } from '#/db';
import { boards, cardLabels, cards, labels } from '#/db/schema';
import { LABEL_EXISTS_MESSAGE } from '#/lib/labels';
import { QuotaExceededError, QuotaKind, USER_QUOTAS } from '#/lib/quotas';
import type { Quotas } from '#/lib/quotas';
import { findOwnedCard, ownedBoardIds, ownedCardIds } from '#/server/access';
import { and, asc, count, eq, inArray } from 'drizzle-orm';

export interface LabelInput {
    title: string | null;
    color: string;
}

function isDuplicateTitle(error: unknown): boolean {
    for (let e = error; e instanceof Error; e = e.cause) {
        if (
            'constraint' in e &&
            e.constraint === 'labels_board_id_title_unique'
        ) {
            return true;
        }
    }
    return false;
}

async function withTitleCheck<T>(write: () => Promise<T>): Promise<T> {
    try {
        return await write();
    } catch (error) {
        if (isDuplicateTitle(error)) throw new Error(LABEL_EXISTS_MESSAGE);
        throw error;
    }
}

export function listLabels(userId: string, boardId: string) {
    return db
        .select()
        .from(labels)
        .where(
            and(
                eq(labels.boardId, boardId),
                inArray(labels.boardId, ownedBoardIds(userId)),
            ),
        )
        .orderBy(asc(labels.createdAt), asc(labels.id));
}

export async function createLabel(
    userId: string,
    boardId: string,
    input: LabelInput,
    quotas: Quotas = USER_QUOTAS,
) {
    const board = await db.query.boards.findFirst({
        where: and(eq(boards.id, boardId), eq(boards.ownerId, userId)),
    });
    if (!board) return null;
    const [{ n }] = await db
        .select({ n: count() })
        .from(labels)
        .where(eq(labels.boardId, boardId));
    if (n >= quotas[QuotaKind.Labels]) {
        throw new QuotaExceededError(
            QuotaKind.Labels,
            quotas[QuotaKind.Labels],
        );
    }
    const [row] = await withTitleCheck(() =>
        db
            .insert(labels)
            .values({ boardId, ...input })
            .returning(),
    );
    return row;
}

export async function updateLabel(
    userId: string,
    labelId: string,
    input: LabelInput,
) {
    const rows = await withTitleCheck(() =>
        db
            .update(labels)
            .set(input)
            .where(
                and(
                    eq(labels.id, labelId),
                    inArray(labels.boardId, ownedBoardIds(userId)),
                ),
            )
            .returning(),
    );
    return rows.at(0) ?? null;
}

export async function deleteLabel(userId: string, labelId: string) {
    const rows = await db
        .delete(labels)
        .where(
            and(
                eq(labels.id, labelId),
                inArray(labels.boardId, ownedBoardIds(userId)),
            ),
        )
        .returning();
    return rows.at(0) ?? null;
}

function touchCard(cardId: string) {
    return db
        .update(cards)
        .set({ updatedAt: new Date() })
        .where(eq(cards.id, cardId));
}

export async function addCardLabel(
    userId: string,
    cardId: string,
    labelId: string,
    quotas: Quotas = USER_QUOTAS,
) {
    const card = await findOwnedCard(userId, cardId);
    if (!card) return false;
    const label = await db.query.labels.findFirst({
        where: and(eq(labels.id, labelId), eq(labels.boardId, card.boardId)),
    });
    if (!label) return false;
    const [{ n }] = await db
        .select({ n: count() })
        .from(cardLabels)
        .where(eq(cardLabels.cardId, cardId));
    if (n >= quotas[QuotaKind.CardLabels]) {
        throw new QuotaExceededError(
            QuotaKind.CardLabels,
            quotas[QuotaKind.CardLabels],
        );
    }
    await db
        .insert(cardLabels)
        .values({ cardId, labelId })
        .onConflictDoNothing();
    await touchCard(cardId);
    return true;
}

export async function removeCardLabel(
    userId: string,
    cardId: string,
    labelId: string,
) {
    const rows = await db
        .delete(cardLabels)
        .where(
            and(
                eq(cardLabels.cardId, cardId),
                eq(cardLabels.labelId, labelId),
                inArray(cardLabels.cardId, ownedCardIds(userId)),
            ),
        )
        .returning();
    if (rows.length === 0) return false;
    await touchCard(cardId);
    return true;
}
