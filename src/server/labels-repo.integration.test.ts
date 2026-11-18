import { repoAccess } from '#/test/access';
import { authorizeBoard } from '#/server/authorize';
import type { BoardAccess } from '#/server/authorize';
import { Action } from '#/lib/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#/db';
import { cardLabels, cards, checklists, labels, lists } from '#/db/schema';
import { LABEL_EXISTS_MESSAGE } from '#/lib/labels';
import { addCardLabelAs } from '#/server/board-writes';
import { deleteBoard, getBoard, moveList } from '#/server/boards-repo';
import {
    addCardLabel,
    createLabel,
    deleteLabel,
    listLabels,
    removeCardLabel,
    updateLabel,
} from '#/server/labels-repo';
import { seedBoardWithAccess, seedBoardWithCard, seedUser } from '#/test/db';
import { eq } from 'drizzle-orm';

let access: BoardAccess;
let boardId: string;
let listId: string;
let cardId: string;

function labelIdsOf(id: string) {
    return db
        .select({ labelId: cardLabels.labelId })
        .from(cardLabels)
        .where(eq(cardLabels.cardId, id))
        .then((rows) => rows.map((r) => r.labelId));
}

async function cardRow(id: string) {
    const [row] = await db.select().from(cards).where(eq(cards.id, id));
    return row;
}

async function newLabel(title: string | null, boardAccess = access) {
    const label = await createLabel(boardAccess, {
        title,
        color: 'green',
    });
    if (!label) throw new Error('Label was not created');
    return label;
}

beforeEach(async () => {
    ({ access, boardId, listId, cardId } = await seedBoardWithCard());
});

describe('labels of a board', () => {
    it('lists the labels of the board in creation order, not of other boards', async () => {
        const other = await seedBoardWithAccess({
            ownerId: access.userId,
            title: 'Other',
        });
        const first = await newLabel('First');
        const untitled = await newLabel(null);
        await newLabel('Elsewhere', other.access);

        const shown = await listLabels(access);
        expect(shown.map((l) => l.id)).toEqual([first.id, untitled.id]);
    });

    it('refuses a title the board already has, ignoring case; untitled labels repeat', async () => {
        await newLabel('Frontend');
        await newLabel(null);
        await newLabel(null);

        await expect(
            createLabel(access, {
                title: 'FRONTEND',
                color: 'red',
            }),
        ).rejects.toThrow(LABEL_EXISTS_MESSAGE);
        const backend = await newLabel('Backend');
        await expect(
            updateLabel(access, backend.id, {
                title: 'frontend',
                color: 'red',
            }),
        ).rejects.toThrow(LABEL_EXISTS_MESSAGE);
        const other = await seedBoardWithAccess({
            ownerId: access.userId,
            title: 'Other',
        });
        expect(await newLabel('Frontend', other.access)).toBeTruthy();
    });
});

describe('isolation', () => {
    it("another user can't read, create, edit or delete the board's labels", async () => {
        const stranger = await seedUser();
        const strangerAccess = await repoAccess(stranger.id, boardId);
        const label = await newLabel('Mine');

        await expect(
            authorizeBoard(stranger.id, boardId, Action.BoardRead),
        ).rejects.toThrow("Board not found or you don't have access");
        expect(
            await createLabel(strangerAccess, {
                title: 'Theirs',
                color: 'red',
            }),
        ).toBeNull();
        expect(
            await updateLabel(strangerAccess, label.id, {
                title: 'Hacked',
                color: 'red',
            }),
        ).toBeNull();
        expect(await deleteLabel(strangerAccess, label.id)).toBeNull();
        expect((await listLabels(access))[0].title).toBe('Mine');
    });

    it("another user can't put a label on or take it off the owner's card", async () => {
        const stranger = await seedUser();
        const strangerAccess = await repoAccess(stranger.id, boardId);
        const label = await newLabel('Mine');
        expect(await addCardLabel(strangerAccess, cardId, label.id)).toBe(
            false,
        );
        expect(await labelIdsOf(cardId)).toEqual([]);

        await addCardLabel(access, cardId, label.id);
        expect(await removeCardLabel(strangerAccess, cardId, label.id)).toBe(
            false,
        );
        expect(await labelIdsOf(cardId)).toEqual([label.id]);
    });

    it("a label of another board can't go on the card, even of the same owner", async () => {
        const other = await seedBoardWithAccess({
            ownerId: access.userId,
            title: 'Other',
        });
        const foreign = await newLabel('Elsewhere', other.access);

        expect(await addCardLabel(access, cardId, foreign.id)).toBe(false);
        expect(await labelIdsOf(cardId)).toEqual([]);
    });
});

describe('labels on a card', () => {
    it('allows more than ten board labels on the same card', async () => {
        const [extra, ...assigned] = await db
            .insert(labels)
            .values(
                Array.from({ length: 11 }, () => ({
                    boardId,
                    color: 'green' as const,
                })),
            )
            .returning();
        await db
            .insert(cardLabels)
            .values(assigned.map(({ id }) => ({ cardId, labelId: id })));

        await addCardLabelAs(
            { id: access.userId, isAnonymous: false },
            cardId,
            extra.id,
        );

        const labelIds = await labelIdsOf(cardId);
        expect(labelIds).toHaveLength(11);
        expect(labelIds).toContain(extra.id);
    });

    it('puts and takes off a label, bumps updated_at, getBoard returns the ids', async () => {
        const label = await newLabel('Frontend');
        const before = (await cardRow(cardId)).updatedAt;

        expect(await addCardLabel(access, cardId, label.id)).toBe(true);
        expect((await cardRow(cardId)).updatedAt.getTime()).toBeGreaterThan(
            before.getTime(),
        );
        const board = await getBoard(access);
        expect(board?.lists[0].cards[0].labelIds).toEqual([label.id]);

        const afterAdd = (await cardRow(cardId)).updatedAt;
        expect(await removeCardLabel(access, cardId, label.id)).toBe(true);
        expect(await labelIdsOf(cardId)).toEqual([]);
        expect((await cardRow(cardId)).updatedAt.getTime()).toBeGreaterThan(
            afterAdd.getTime(),
        );
    });
});

describe('cascades', () => {
    it('deleting a label takes it off every card of the board', async () => {
        const label = await newLabel('Frontend');
        const [second] = await db
            .insert(cards)
            .values({ listId, title: 'Second', position: 'a1' })
            .returning();
        await addCardLabel(access, cardId, label.id);
        await addCardLabel(access, second.id, label.id);

        expect(await deleteLabel(access, label.id)).toBeTruthy();
        expect(await labelIdsOf(cardId)).toEqual([]);
        expect(await labelIdsOf(second.id)).toEqual([]);
    });

    it('deleting a board deletes its labels', async () => {
        const label = await newLabel('Frontend');
        await addCardLabel(access, cardId, label.id);

        await deleteBoard(access);
        const other = await seedBoardWithAccess({
            ownerId: access.userId,
            title: 'Other',
        });
        expect(await listLabels(other.access)).toEqual([]);
        expect(await labelIdsOf(cardId)).toEqual([]);
    });
});

describe('moving a list', () => {
    it('to another board takes the labels off its cards and keeps due, completed and checklist', async () => {
        const label = await newLabel('Frontend');
        await addCardLabel(access, cardId, label.id);
        const due = { dueDate: '2026-10-15', completedAt: new Date() };
        await db.update(cards).set(due).where(eq(cards.id, cardId));
        await db.insert(checklists).values({ cardId, title: 'Checklist' });
        const { access: targetAccess } = await seedBoardWithAccess({
            ownerId: access.userId,
            title: 'Target',
        });

        expect(
            await moveList(access, listId, targetAccess, null, null),
        ).toBeTruthy();

        expect(await labelIdsOf(cardId)).toEqual([]);
        // The label stays on its board.
        expect(await listLabels(access)).toHaveLength(1);
        const moved = await cardRow(cardId);
        expect(moved.dueDate).toBe(due.dueDate);
        expect(moved.completedAt).not.toBeNull();
        const [checklist] = await db
            .select()
            .from(checklists)
            .where(eq(checklists.cardId, cardId));
        expect(checklist.title).toBe('Checklist');
    });

    it('within its board keeps the labels', async () => {
        const label = await newLabel('Frontend');
        await addCardLabel(access, cardId, label.id);
        const [second] = await db
            .insert(lists)
            .values({ boardId, title: 'Second', position: 'a1' })
            .returning();

        expect(
            await moveList(access, listId, access, second.id, null),
        ).toBeTruthy();
        expect(await labelIdsOf(cardId)).toEqual([label.id]);
    });
});
