import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#/db';
import { boards, cards, labels, lists } from '#/db/schema';
import { seedUser } from '#/test/db';

// Constraints of the card enrichment migration (#120) that live in the database,
// not in the repo code.

let boardId: string;
let listId: string;

beforeEach(async () => {
    const owner = await seedUser();
    const [board] = await db
        .insert(boards)
        .values({ ownerId: owner.id, title: 'Board' })
        .returning();
    const [list] = await db
        .insert(lists)
        .values({ boardId: board.id, title: 'List', position: 'a0' })
        .returning();
    boardId = board.id;
    listId = list.id;
});

const violation = (constraint: string) => ({ cause: { constraint } });

describe('cards due date', () => {
    it('keeps either a whole day or a moment, never both', async () => {
        const card = { listId, title: 'Card', position: 'a0' };

        await db.insert(cards).values({ ...card, dueDate: '2026-10-15' });
        await db
            .insert(cards)
            .values({ ...card, dueAt: new Date('2026-10-15T15:00:00Z') });
        await expect(
            db.insert(cards).values({
                ...card,
                dueDate: '2026-10-15',
                dueAt: new Date('2026-10-15T15:00:00Z'),
            }),
        ).rejects.toMatchObject(violation('cards_due_check'));
    });
});

describe('labels title', () => {
    it('is unique on a board ignoring case, untitled labels repeat', async () => {
        await db.insert(labels).values([
            { boardId, title: 'Frontend', color: 'green' },
            { boardId, title: null, color: 'red' },
            { boardId, title: null, color: 'red' },
        ]);

        await expect(
            db
                .insert(labels)
                .values({ boardId, title: 'frontend', color: 'blue' }),
        ).rejects.toMatchObject(violation('labels_board_id_title_unique'));
    });
});
