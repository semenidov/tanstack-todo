import { describe, expect, it } from 'vitest';
import { db } from '#/db';
import {
    boards,
    cards,
    checklistItems,
    checklists,
    labels,
    lists,
} from '#/db/schema';
import { GUEST_QUOTAS, QuotaExceededError, QuotaKind } from '#/lib/quotas';
import { deleteCard } from '#/server/boards-repo';
import {
    addCardAs,
    addChecklistItemAs,
    addListAs,
    createLabelAs,
    createBoardAs,
    restoreCardAs,
} from '#/server/board-writes';
import { moveListOrThrow } from '#/server/move-list';
import { seedBoardWithAccess, seedUser } from '#/test/db';
import { and, count, eq, isNull } from 'drizzle-orm';
import { generateNKeysBetween } from 'fractional-indexing';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

async function seedBoards(userId: string, n: number) {
    return db
        .insert(boards)
        .values(range(n).map((i) => ({ ownerId: userId, title: `Board ${i}` })))
        .returning();
}

async function seedLists(boardId: string, n: number) {
    const keys = generateNKeysBetween(null, null, n);
    return db
        .insert(lists)
        .values(
            keys.map((position, i) => ({
                boardId,
                title: `List ${i}`,
                position,
            })),
        )
        .returning();
}

async function seedCards(listId: string, n: number) {
    const keys = generateNKeysBetween(null, null, n);
    return db
        .insert(cards)
        .values(
            keys.map((position, i) => ({
                listId,
                title: `Card ${i}`,
                position,
            })),
        )
        .returning();
}

async function liveCardCount(listId: string) {
    const [row] = await db
        .select({ n: count() })
        .from(cards)
        .where(and(eq(cards.listId, listId), isNull(cards.deletedAt)));
    return row.n;
}

describe('content quotas', () => {
    const guestLimit = (kind: QuotaKind) =>
        new QuotaExceededError(kind, GUEST_QUOTAS[kind]);

    async function seedGuest() {
        const row = await seedUser({ isAnonymous: true });
        return { id: row.id, isAnonymous: true };
    }

    it('createBoard: refuses the 4th board', async () => {
        const guest = await seedGuest();
        await seedBoards(guest.id, GUEST_QUOTAS[QuotaKind.Boards]);

        await expect(createBoardAs(guest, 'One more')).rejects.toThrow(
            guestLimit(QuotaKind.Boards),
        );
    });

    it('addList: refuses the 11th list', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        await seedLists(board.id, GUEST_QUOTAS[QuotaKind.Lists]);

        await expect(addListAs(guest, board.id, 'One more')).rejects.toThrow(
            guestLimit(QuotaKind.Lists),
        );
    });

    it('adds the last allowed card and refuses the next without inserting it', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [list] = await seedLists(board.id, 1);
        const limit = GUEST_QUOTAS[QuotaKind.Cards];
        await seedCards(list.id, limit - 1);

        await expect(addCardAs(guest, list.id, 'Fits')).resolves.toMatchObject({
            listId: list.id,
        });
        await expect(addCardAs(guest, list.id, 'One more')).rejects.toThrow(
            guestLimit(QuotaKind.Cards),
        );
        expect(await liveCardCount(list.id)).toBe(limit);
    });

    it('createLabel: refuses the 11th label on a board', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        await db.insert(labels).values(
            range(GUEST_QUOTAS[QuotaKind.Labels]).map(() => ({
                boardId: board.id,
                title: null,
                color: 'green',
            })),
        );

        await expect(
            createLabelAs(guest, board.id, { title: 'Typed', color: 'red' }),
        ).rejects.toThrow(guestLimit(QuotaKind.Labels));
    });

    it('addChecklistItem: refuses the 21st item; the checklist keeps 20', async () => {
        const guest = await seedGuest();
        const [board] = await seedBoards(guest.id, 1);
        const [list] = await seedLists(board.id, 1);
        const [card] = await seedCards(list.id, 1);
        const [checklist] = await db
            .insert(checklists)
            .values({ cardId: card.id, title: 'Steps' })
            .returning();
        const limit = GUEST_QUOTAS[QuotaKind.ChecklistItems];
        const keys = generateNKeysBetween(null, null, limit);
        await db.insert(checklistItems).values(
            keys.map((position) => ({
                checklistId: checklist.id,
                title: 'Item',
                position,
            })),
        );

        await expect(
            addChecklistItemAs(guest, checklist.id, 'Typed'),
        ).rejects.toThrow(guestLimit(QuotaKind.ChecklistItems));
        const [{ n }] = await db
            .select({ n: count() })
            .from(checklistItems)
            .where(eq(checklistItems.checklistId, checklist.id));
        expect(n).toBe(limit);
    });

    it('restoreCard: refuses when the list is full again', async () => {
        const guest = await seedGuest();
        const { board, access } = await seedBoardWithAccess({
            ownerId: guest.id,
        });
        const [list] = await seedLists(board.id, 1);
        const [first] = await seedCards(list.id, GUEST_QUOTAS[QuotaKind.Cards]);
        await deleteCard(access, first.id);
        await addCardAs(guest, list.id, 'Took the place');

        await expect(restoreCardAs(guest, first.id)).rejects.toThrow(
            guestLimit(QuotaKind.Cards),
        );
        expect(await liveCardCount(list.id)).toBe(
            GUEST_QUOTAS[QuotaKind.Cards],
        );
    });

    it('moveList: refuses a move onto a board with 10 lists', async () => {
        const guest = await seedGuest();
        const [full, other] = await seedBoards(guest.id, 2);
        await seedLists(full.id, GUEST_QUOTAS[QuotaKind.Lists]);
        const [list] = await seedLists(other.id, 1);

        await expect(
            moveListOrThrow(guest, {
                listId: list.id,
                toBoardId: full.id,
                prevListId: null,
                nextListId: null,
            }),
        ).rejects.toThrow(guestLimit(QuotaKind.Lists));
        const [stored] = await db
            .select({ boardId: lists.boardId, position: lists.position })
            .from(lists)
            .where(eq(lists.id, list.id));
        expect(stored).toEqual({ boardId: other.id, position: list.position });
    });

    it('lets a regular user create a board above the guest limit', async () => {
        const regular = { id: (await seedUser()).id, isAnonymous: false };
        await seedBoards(regular.id, GUEST_QUOTAS[QuotaKind.Boards]);

        await expect(
            createBoardAs(regular, 'Over the guest limit'),
        ).resolves.toMatchObject({ ownerId: regular.id });
    });
});
