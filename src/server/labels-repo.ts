import { db } from '#/db';
import { boards, cardLabels, cards, labels } from '#/db/schema';
import { LABEL_EXISTS_MESSAGE } from '#/lib/labels';
import { QuotaExceededError, QuotaKind, USER_QUOTAS } from '#/lib/quotas';
import type { Quotas } from '#/lib/quotas';
import {
    findAccessibleCard,
    accessibleCardIds,
    accessibleBoardIds,
} from '#/server/access';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { BoardAccess } from '#/server/authorize';

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

export function listLabels(access: BoardAccess) {
    return db
        .select()
        .from(labels)
        .where(
            and(
                eq(labels.boardId, access.boardId),
                inArray(labels.boardId, accessibleBoardIds(access.userId)),
            ),
        )
        .orderBy(asc(labels.createdAt), asc(labels.id));
}

export async function createLabel(
    access: BoardAccess,
    boardId: string,
    input: LabelInput,
    quotas: Quotas = USER_QUOTAS,
) {
    const board = await db.query.boards.findFirst({
        where: and(
            eq(boards.id, access.boardId),
            inArray(boards.id, accessibleBoardIds(access.userId)),
        ),
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
            .select(
                db
                    .select({
                        id: sql<string>`gen_random_uuid()`.as('id'),
                        boardId: boards.id,
                        title: sql<string | null>`${input.title}::text`.as(
                            'title',
                        ),
                        color: sql<string>`${input.color}`.as('color'),
                        createdAt: sql<Date>`now()`.as('createdAt'),
                    })
                    .from(boards)
                    .where(
                        and(
                            eq(boards.id, access.boardId),
                            eq(boards.id, boardId),
                            inArray(
                                boards.id,
                                accessibleBoardIds(access.userId),
                            ),
                        ),
                    ),
            )
            .returning(),
    );
    return row;
}

export async function updateLabel(
    access: BoardAccess,
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
                    and(
                        eq(labels.boardId, access.boardId),
                        inArray(
                            labels.boardId,
                            accessibleBoardIds(access.userId),
                        ),
                    ),
                ),
            )
            .returning(),
    );
    return rows.at(0) ?? null;
}

export async function deleteLabel(access: BoardAccess, labelId: string) {
    const rows = await db
        .delete(labels)
        .where(
            and(
                eq(labels.id, labelId),
                and(
                    eq(labels.boardId, access.boardId),
                    inArray(labels.boardId, accessibleBoardIds(access.userId)),
                ),
            ),
        )
        .returning();
    return rows.at(0) ?? null;
}

function touchCard(access: BoardAccess, cardId: string) {
    return db
        .update(cards)
        .set({ updatedAt: new Date() })
        .where(
            and(
                eq(cards.id, cardId),
                inArray(
                    cards.id,
                    accessibleCardIds(access.userId, access.boardId),
                ),
            ),
        );
}

export async function addCardLabel(
    access: BoardAccess,
    cardId: string,
    labelId: string,
    quotas: Quotas = USER_QUOTAS,
) {
    const card = await findAccessibleCard(
        access.userId,
        access.boardId,
        cardId,
    );
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
    const inserted = await db
        .insert(cardLabels)
        .select(
            db
                .select({ cardId: cards.id, labelId: labels.id })
                .from(cards)
                .innerJoin(
                    labels,
                    and(
                        eq(labels.id, labelId),
                        eq(labels.boardId, access.boardId),
                    ),
                )
                .where(
                    and(
                        eq(cards.id, cardId),
                        inArray(
                            cards.id,
                            accessibleCardIds(access.userId, access.boardId),
                        ),
                    ),
                ),
        )
        .onConflictDoNothing()
        .returning();
    if (inserted.length === 0) return false;
    await touchCard(access, cardId);
    return true;
}

export async function removeCardLabel(
    access: BoardAccess,
    cardId: string,
    labelId: string,
) {
    const rows = await db
        .delete(cardLabels)
        .where(
            and(
                eq(cardLabels.cardId, cardId),
                eq(cardLabels.labelId, labelId),
                inArray(
                    cardLabels.cardId,
                    accessibleCardIds(access.userId, access.boardId),
                ),
            ),
        )
        .returning();
    if (rows.length === 0) return false;
    await touchCard(access, cardId);
    return true;
}
