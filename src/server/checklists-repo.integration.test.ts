import { repoAccess } from '#/test/access';
import { authorizeBoard, authorizeCard } from '#/server/authorize';
import { Action } from '#/lib/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#/db';
import { cards, checklistItems, lists } from '#/db/schema';
import { createBoard, getBoard } from '#/server/boards-repo';
import {
    addChecklistItem,
    createChecklist,
    deleteChecklist,
    deleteChecklistItem,
    getChecklist,
    moveChecklistItem,
    renameChecklist,
    updateChecklistItem,
} from '#/server/checklists-repo';
import { seedUser } from '#/test/db';
import { eq } from 'drizzle-orm';

let ownerId: string;
let boardId: string;
let cardId: string;

beforeEach(async () => {
    ownerId = (await seedUser()).id;
    const board = await createBoard(ownerId, 'Board');
    boardId = board.id;
    const [list] = await db
        .insert(lists)
        .values({ boardId, title: 'List', position: 'a0' })
        .returning();
    const [card] = await db
        .insert(cards)
        .values({ listId: list.id, title: 'Card', position: 'a0' })
        .returning();
    cardId = card.id;
});

async function newChecklist() {
    const checklist = await createChecklist(
        await repoAccess(ownerId, cardId),
        cardId,
        'Steps',
    );
    if (!checklist) throw new Error('Checklist was not created');
    return checklist;
}

async function newItem(checklistId: string, title: string) {
    const item = await addChecklistItem(
        await repoAccess(ownerId, checklistId),
        checklistId,
        title,
    );
    if (!item) throw new Error('Item was not added');
    return item;
}

async function itemTitles() {
    const checklist = await getChecklist(
        await authorizeCard(ownerId, cardId, Action.BoardRead),
        cardId,
    );
    return checklist?.items.map((i) => i.title);
}

async function updatedAt() {
    const [row] = await db.select().from(cards).where(eq(cards.id, cardId));
    return row.updatedAt.getTime();
}

async function boardCard() {
    const board = await getBoard(
        await authorizeBoard(ownerId, boardId, Action.BoardRead),
    );
    return board?.lists[0].cards[0];
}

describe('checklist items order', () => {
    it('keeps items in the order they were added', async () => {
        const checklist = await newChecklist();
        for (const title of ['A', 'B', 'C']) {
            await newItem(checklist.id, title);
        }
        expect(await itemTitles()).toEqual(['A', 'B', 'C']);
    });

    it('moves an item between the neighbors, to the top and to the bottom', async () => {
        const checklist = await newChecklist();
        const [a, b, c] = [
            await newItem(checklist.id, 'A'),
            await newItem(checklist.id, 'B'),
            await newItem(checklist.id, 'C'),
        ];

        expect(
            await moveChecklistItem(
                await repoAccess(ownerId, a.id),
                a.id,
                b.id,
                c.id,
            ),
        ).toBeTruthy();
        expect(await itemTitles()).toEqual(['B', 'A', 'C']);

        expect(
            await moveChecklistItem(
                await repoAccess(ownerId, c.id),
                c.id,
                null,
                b.id,
            ),
        ).toBeTruthy();
        expect(await itemTitles()).toEqual(['C', 'B', 'A']);

        expect(
            await moveChecklistItem(
                await repoAccess(ownerId, c.id),
                c.id,
                a.id,
                null,
            ),
        ).toBeTruthy();
        expect(await itemTitles()).toEqual(['B', 'A', 'C']);
    });

    it('renumbers the items when the neighbors share a key', async () => {
        const checklist = await newChecklist();
        const a = await newItem(checklist.id, 'A');
        const b = await newItem(checklist.id, 'B');
        const c = await newItem(checklist.id, 'C');
        // Two tabs inserted at one place: A and B got the same key.
        await db
            .update(checklistItems)
            .set({ position: a.position })
            .where(eq(checklistItems.id, b.id));

        // Equal keys are ordered by id: take the order the client would see.
        const before = await getChecklist(
            await authorizeCard(ownerId, cardId, Action.BoardRead),
            cardId,
        );
        const [first, second] = before?.items ?? [];

        expect(
            await moveChecklistItem(
                await repoAccess(ownerId, c.id),
                c.id,
                first.id,
                second.id,
            ),
        ).toBeTruthy();
        expect(await itemTitles()).toEqual([first.title, 'C', second.title]);
    });

    it('refuses neighbors from another checklist or in a stale order', async () => {
        const checklist = await newChecklist();
        const a = await newItem(checklist.id, 'A');
        const b = await newItem(checklist.id, 'B');
        const c = await newItem(checklist.id, 'C');
        const [otherList] = await db
            .insert(lists)
            .values({ boardId, title: 'Other', position: 'a1' })
            .returning();
        const [otherCard] = await db
            .insert(cards)
            .values({ listId: otherList.id, title: 'Other', position: 'a0' })
            .returning();
        const other = await createChecklist(
            await repoAccess(ownerId, otherCard.id),
            otherCard.id,
            'Other',
        );
        if (!other) throw new Error('Checklist was not created');
        const foreign = await newItem(other.id, 'Foreign');

        expect(
            await moveChecklistItem(
                await repoAccess(ownerId, a.id),
                a.id,
                foreign.id,
                null,
            ),
        ).toBeNull();
        // C before B: the client saw another order.
        expect(
            await moveChecklistItem(
                await repoAccess(ownerId, a.id),
                a.id,
                c.id,
                b.id,
            ),
        ).toBeNull();
        expect(await itemTitles()).toEqual(['A', 'B', 'C']);
    });
});

describe('checklist on the board', () => {
    it('counts done and total items of the card in getBoard', async () => {
        expect(await boardCard()).toMatchObject({
            checklistDone: 0,
            checklistTotal: 0,
        });
        const checklist = await newChecklist();
        const items = [
            await newItem(checklist.id, 'A'),
            await newItem(checklist.id, 'B'),
            await newItem(checklist.id, 'C'),
        ];
        await updateChecklistItem(
            await repoAccess(ownerId, items[0].id),
            items[0].id,
            { done: true },
        );
        await updateChecklistItem(
            await repoAccess(ownerId, items[2].id),
            items[2].id,
            { done: true },
        );
        expect(await boardCard()).toMatchObject({
            checklistDone: 2,
            checklistTotal: 3,
        });

        await deleteChecklistItem(
            await repoAccess(ownerId, items[0].id),
            items[0].id,
        );
        await updateChecklistItem(
            await repoAccess(ownerId, items[1].id),
            items[1].id,
            { title: 'B2' },
        );
        expect(await boardCard()).toMatchObject({
            checklistDone: 1,
            checklistTotal: 2,
        });
        expect(await itemTitles()).toEqual(['B2', 'C']);

        await deleteChecklist(
            await repoAccess(ownerId, checklist.id),
            checklist.id,
        );
        expect(
            await getChecklist(
                await authorizeCard(ownerId, cardId, Action.BoardRead),
                cardId,
            ),
        ).toBeNull();
        expect(await boardCard()).toMatchObject({
            checklistDone: 0,
            checklistTotal: 0,
        });
    });

    it('one checklist per card', async () => {
        await newChecklist();
        expect(
            await createChecklist(
                await repoAccess(ownerId, cardId),
                cardId,
                'Second',
            ),
        ).toBeNull();
    });

    it('every edit bumps the card updated_at', async () => {
        const edits: Array<() => Promise<unknown>> = [];
        const checklist = await newChecklist();
        const item = await newItem(checklist.id, 'A');
        const last = await newItem(checklist.id, 'B');
        edits.push(
            async () =>
                renameChecklist(
                    await repoAccess(ownerId, checklist.id),
                    checklist.id,
                    'Renamed',
                ),
            () => newItem(checklist.id, 'C'),
            async () =>
                updateChecklistItem(
                    await repoAccess(ownerId, item.id),
                    item.id,
                    { done: true },
                ),
            async () =>
                moveChecklistItem(
                    await repoAccess(ownerId, item.id),
                    item.id,
                    last.id,
                    null,
                ),
            async () =>
                deleteChecklistItem(
                    await repoAccess(ownerId, item.id),
                    item.id,
                ),
            async () =>
                deleteChecklist(
                    await repoAccess(ownerId, checklist.id),
                    checklist.id,
                ),
        );
        for (const edit of edits) {
            const before = await updatedAt();
            await edit();
            expect(await updatedAt()).toBeGreaterThan(before);
        }
    });
});

describe('checklist access', () => {
    it("someone else can't read or change the checklist", async () => {
        const checklist = await newChecklist();
        const item = await newItem(checklist.id, 'A');
        const strangerId = (await seedUser()).id;

        await expect(
            authorizeCard(strangerId, cardId, Action.BoardRead),
        ).rejects.toThrow("Board not found or you don't have access");
        expect(
            await createChecklist(
                await repoAccess(strangerId, cardId),
                cardId,
                'X',
            ),
        ).toBeNull();
        expect(
            await addChecklistItem(
                await repoAccess(strangerId, checklist.id),
                checklist.id,
                'X',
            ),
        ).toBeNull();
        expect(
            await renameChecklist(
                await repoAccess(strangerId, checklist.id),
                checklist.id,
                'X',
            ),
        ).toBeNull();
        expect(
            await updateChecklistItem(
                await repoAccess(strangerId, item.id),
                item.id,
                { done: true },
            ),
        ).toBeNull();
        expect(
            await moveChecklistItem(
                await repoAccess(strangerId, item.id),
                item.id,
                null,
                null,
            ),
        ).toBeNull();
        expect(
            await deleteChecklistItem(
                await repoAccess(strangerId, item.id),
                item.id,
            ),
        ).toBeNull();
        expect(
            await deleteChecklist(
                await repoAccess(strangerId, checklist.id),
                checklist.id,
            ),
        ).toBeNull();

        const own = await getChecklist(
            await authorizeCard(ownerId, cardId, Action.BoardRead),
            cardId,
        );
        expect(own).toMatchObject({ title: 'Steps' });
        expect(own?.items).toMatchObject([{ title: 'A', done: false }]);
    });
});
