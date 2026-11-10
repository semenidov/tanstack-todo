import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers, cards, lists } from '#/db/schema';
import { Action, BOARD_ACCESS_DENIED } from '#/lib/permissions';
import { seedBoardMember, seedUser } from '#/test/db';
import {
    authorizeBoard,
    authorizeCard,
    authorizeChecklistItem,
    authorizeLabel,
    requireChanged,
} from './authorize';
import type { BoardAccess } from './authorize';
import * as boards from './boards-repo';
import * as labels from './labels-repo';
import * as checks from './checklists-repo';
import { addCardAs, restoreListAs, restoreCardAs } from './board-writes';
import { moveListOrThrow } from './move-list';

async function fixture() {
    const owner = { ...(await seedUser()), isAnonymous: false };
    const editor = { ...(await seedUser()), isAnonymous: false };
    const board = await boards.createBoard(owner.id, 'Shared');
    await seedBoardMember(board.id, editor.id);
    const access = await authorizeBoard(
        editor.id,
        board.id,
        Action.ContentEdit,
    );
    const ownerAccess = await authorizeBoard(
        owner.id,
        board.id,
        Action.ContentEdit,
    );
    const list = requireChanged(
        await boards.addList(ownerAccess, board.id, 'Tasks'),
    );
    const card = requireChanged(
        await boards.addCard(ownerAccess, list.id, 'Task'),
    );
    return { owner, editor, board, access, ownerAccess, list, card };
}

async function seedLabel(access: BoardAccess) {
    return requireChanged(
        await labels.createLabel(access, access.boardId, {
            title: 'Label',
            color: 'red',
        }),
    );
}

async function seedChecklistItem(access: BoardAccess, cardId: string) {
    const checklist = requireChanged(
        await checks.createChecklist(access, cardId, 'Steps'),
    );
    return requireChanged(
        await checks.addChecklistItem(access, checklist.id, 'Item'),
    );
}

describe('content authorization', () => {
    it('an editor can update a card on a shared board', async () => {
        const { editor, card } = await fixture();
        const pass = await authorizeCard(
            editor.id,
            card.id,
            Action.ContentEdit,
        );

        const [updated] = await boards.updateCard(pass, card.id, {
            title: 'Edited',
        });
        expect(updated).toMatchObject({ id: card.id, title: 'Edited' });
    });

    it('an editor can update a shared board label', async () => {
        const { editor, ownerAccess } = await fixture();
        const label = await seedLabel(ownerAccess);
        const pass = await authorizeLabel(
            editor.id,
            label.id,
            Action.ContentEdit,
        );

        expect(
            await labels.updateLabel(pass, label.id, {
                title: 'Edited label',
                color: label.color,
            }),
        ).toMatchObject({ id: label.id, title: 'Edited label' });
    });

    it('an editor can complete a checklist item on a shared card', async () => {
        const { editor, ownerAccess, card } = await fixture();
        const item = await seedChecklistItem(ownerAccess, card.id);
        const pass = await authorizeChecklistItem(
            editor.id,
            item.id,
            Action.ContentEdit,
        );

        expect(
            await checks.updateChecklistItem(pass, item.id, { done: true }),
        ).toMatchObject({ id: item.id, done: true });
    });

    it('an editor can restore a card once its list is restored', async () => {
        const { editor, ownerAccess, list, card } = await fixture();
        requireChanged(await boards.deleteCard(ownerAccess, card.id));
        requireChanged(await boards.deleteList(ownerAccess, list.id));

        await expect(restoreCardAs(editor, card.id)).rejects.toThrow(
            BOARD_ACCESS_DENIED,
        );
        await restoreListAs(editor, list.id);
        await restoreCardAs(editor, card.id);

        expect(
            await authorizeCard(editor.id, card.id, Action.BoardRead),
        ).toMatchObject({
            boardId: ownerAccess.boardId,
        });
    });

    it('an editor cannot start a new write after losing membership', async () => {
        const { editor, list } = await fixture();
        await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));

        await expect(addCardAs(editor, list.id, 'Forbidden')).rejects.toThrow(
            BOARD_ACCESS_DENIED,
        );
    });

    it('repositories reject writes with a pass issued before membership was removed', async () => {
        const { editor, access, ownerAccess, list, card } = await fixture();
        const label = await seedLabel(ownerAccess);
        const item = await seedChecklistItem(ownerAccess, card.id);
        await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));

        expect(await boards.addCard(access, list.id, 'Forbidden')).toBeNull();
        expect(
            await boards.updateCard(access, card.id, { title: 'Forbidden' }),
        ).toEqual([]);
        expect(
            await labels.updateLabel(access, label.id, {
                title: 'Forbidden',
                color: label.color,
            }),
        ).toBeNull();
        expect(
            await checks.updateChecklistItem(access, item.id, { done: true }),
        ).toBeNull();
        expect(
            await db.query.cards.findFirst({ where: eq(cards.id, card.id) }),
        ).toMatchObject({ title: card.title });
    });

    it('scopes passes to their board, rejects stale resources and requires owners at both move ends', async () => {
        const { owner, editor, board, access, list, card } = await fixture();
        const ownBoard = await boards.createBoard(editor.id, 'Editor owns');
        await expect(
            moveListOrThrow(editor, {
                listId: list.id,
                toBoardId: ownBoard.id,
                prevListId: null,
                nextListId: null,
            }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        const ownerOther = await boards.createBoard(owner.id, 'Other');
        await seedBoardMember(ownBoard.id, owner.id);
        await expect(
            moveListOrThrow(owner, {
                listId: list.id,
                toBoardId: ownBoard.id,
                prevListId: null,
                nextListId: null,
            }),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        requireChanged(await boards.deleteCard(access, card.id));
        await expect(
            boards
                .updateCard(access, card.id, { title: 'Stale' })
                .then(requireChanged),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            boards
                .renameList(
                    await authorizeBoard(
                        owner.id,
                        ownerOther.id,
                        Action.ContentEdit,
                    ),
                    list.id,
                    'Wrong board',
                )
                .then(requireChanged),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await moveListOrThrow(owner, {
            listId: list.id,
            toBoardId: ownerOther.id,
            prevListId: null,
            nextListId: null,
        });
        expect(
            (await db.query.lists.findFirst({ where: eq(lists.id, list.id) }))
                ?.boardId,
        ).toBe(ownerOther.id);
        await expect(
            boards.restoreCard(access, card.id).then(requireChanged),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        expect(
            (
                await boards.getBoard(
                    await authorizeBoard(owner.id, board.id, Action.BoardRead),
                )
            )?.lists,
        ).toEqual([]);
    });
});
