import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#/db';
import { cardLabels, cards, checklists, lists } from '#/db/schema';
import { LABEL_EXISTS_MESSAGE } from '#/lib/labels';
import {
    createBoard,
    deleteBoard,
    getBoard,
    moveList,
} from '#/server/boards-repo';
import {
    addCardLabel,
    createLabel,
    deleteLabel,
    listLabels,
    removeCardLabel,
    updateLabel,
} from '#/server/labels-repo';
import { seedUser } from '#/test/db';
import { eq } from 'drizzle-orm';

let ownerId: string;
let boardId: string;
let listId: string;
let cardId: string;

async function seedBoardWithCard(userId: string, title = 'Board') {
    const board = await createBoard(userId, title);
    const [list] = await db
        .insert(lists)
        .values({ boardId: board.id, title: 'List', position: 'a0' })
        .returning();
    const [card] = await db
        .insert(cards)
        .values({ listId: list.id, title: 'Card', position: 'a0' })
        .returning();
    return { boardId: board.id, listId: list.id, cardId: card.id };
}

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

async function newLabel(title: string | null, board = boardId) {
    const label = await createLabel(ownerId, board, { title, color: 'green' });
    if (!label) throw new Error('Label was not created');
    return label;
}

beforeEach(async () => {
    const owner = await seedUser();
    ownerId = owner.id;
    ({ boardId, listId, cardId } = await seedBoardWithCard(ownerId));
});

describe('labels of a board', () => {
    it('lists the labels of the board in creation order, not of other boards', async () => {
        const other = await seedBoardWithCard(ownerId, 'Other');
        const first = await newLabel('First');
        const untitled = await newLabel(null);
        await newLabel('Elsewhere', other.boardId);

        const shown = await listLabels(ownerId, boardId);
        expect(shown.map((l) => l.id)).toEqual([first.id, untitled.id]);
    });

    it('refuses a title the board already has, ignoring case; untitled labels repeat', async () => {
        await newLabel('Frontend');
        await newLabel(null);
        await newLabel(null);

        await expect(
            createLabel(ownerId, boardId, { title: 'FRONTEND', color: 'red' }),
        ).rejects.toThrow(LABEL_EXISTS_MESSAGE);
        const backend = await newLabel('Backend');
        await expect(
            updateLabel(ownerId, backend.id, {
                title: 'frontend',
                color: 'red',
            }),
        ).rejects.toThrow(LABEL_EXISTS_MESSAGE);
        // The same title on another board is fine.
        const other = await seedBoardWithCard(ownerId, 'Other');
        expect(await newLabel('Frontend', other.boardId)).toBeTruthy();
    });
});

describe('isolation', () => {
    it("another user can't read, create, edit or delete the board's labels", async () => {
        const stranger = await seedUser();
        const label = await newLabel('Mine');

        expect(await listLabels(stranger.id, boardId)).toEqual([]);
        expect(
            await createLabel(stranger.id, boardId, {
                title: 'Theirs',
                color: 'red',
            }),
        ).toBeNull();
        expect(
            await updateLabel(stranger.id, label.id, {
                title: 'Hacked',
                color: 'red',
            }),
        ).toBeNull();
        expect(await deleteLabel(stranger.id, label.id)).toBeNull();
        expect((await listLabels(ownerId, boardId))[0].title).toBe('Mine');
    });

    it("another user can't put a label on or take it off the owner's card", async () => {
        const stranger = await seedUser();
        const label = await newLabel('Mine');
        expect(await addCardLabel(stranger.id, cardId, label.id)).toBe(false);
        expect(await labelIdsOf(cardId)).toEqual([]);

        await addCardLabel(ownerId, cardId, label.id);
        expect(await removeCardLabel(stranger.id, cardId, label.id)).toBe(
            false,
        );
        expect(await labelIdsOf(cardId)).toEqual([label.id]);
    });

    it("a label of another board can't go on the card, even of the same owner", async () => {
        const other = await seedBoardWithCard(ownerId, 'Other');
        const foreign = await newLabel('Elsewhere', other.boardId);

        expect(await addCardLabel(ownerId, cardId, foreign.id)).toBe(false);
        expect(await labelIdsOf(cardId)).toEqual([]);
    });
});

describe('labels on a card', () => {
    it('puts and takes off a label, bumps updated_at, getBoard returns the ids', async () => {
        const label = await newLabel('Frontend');
        const before = (await cardRow(cardId)).updatedAt;

        expect(await addCardLabel(ownerId, cardId, label.id)).toBe(true);
        expect((await cardRow(cardId)).updatedAt.getTime()).toBeGreaterThan(
            before.getTime(),
        );
        const board = await getBoard(ownerId, boardId);
        expect(board?.lists[0].cards[0].labelIds).toEqual([label.id]);

        const afterAdd = (await cardRow(cardId)).updatedAt;
        expect(await removeCardLabel(ownerId, cardId, label.id)).toBe(true);
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
        await addCardLabel(ownerId, cardId, label.id);
        await addCardLabel(ownerId, second.id, label.id);

        expect(await deleteLabel(ownerId, label.id)).toBeTruthy();
        expect(await labelIdsOf(cardId)).toEqual([]);
        expect(await labelIdsOf(second.id)).toEqual([]);
    });

    it('deleting a board deletes its labels', async () => {
        const label = await newLabel('Frontend');
        await addCardLabel(ownerId, cardId, label.id);

        await deleteBoard(ownerId, boardId);
        const other = await seedBoardWithCard(ownerId, 'Other');
        expect(await listLabels(ownerId, other.boardId)).toEqual([]);
        expect(await labelIdsOf(cardId)).toEqual([]);
    });
});

describe('moving a list', () => {
    it('to another board takes the labels off its cards and keeps due, completed and checklist', async () => {
        const label = await newLabel('Frontend');
        await addCardLabel(ownerId, cardId, label.id);
        const due = { dueDate: '2026-10-15', completedAt: new Date() };
        await db.update(cards).set(due).where(eq(cards.id, cardId));
        await db.insert(checklists).values({ cardId, title: 'Checklist' });
        const target = await createBoard(ownerId, 'Target');

        expect(
            await moveList(ownerId, listId, target.id, null, null),
        ).toBeTruthy();

        expect(await labelIdsOf(cardId)).toEqual([]);
        // The label stays on its board.
        expect(await listLabels(ownerId, boardId)).toHaveLength(1);
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
        await addCardLabel(ownerId, cardId, label.id);
        const [second] = await db
            .insert(lists)
            .values({ boardId, title: 'Second', position: 'a1' })
            .returning();

        expect(
            await moveList(ownerId, listId, boardId, second.id, null),
        ).toBeTruthy();
        expect(await labelIdsOf(cardId)).toEqual([label.id]);
    });
});
