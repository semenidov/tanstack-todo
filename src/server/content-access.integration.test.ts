import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers, cards, lists } from '#/db/schema';
import { Action, BOARD_ACCESS_DENIED } from '#/lib/permissions';
import { seedBoardMember, seedUser } from '#/test/db';
import {
    authorizeBoard,
    authorizeCard,
    authorizeList,
    authorizeChecklist,
    authorizeChecklistItem,
    authorizeLabel,
    requireChanged,
} from './authorize';
import * as boards from './boards-repo';
import * as labels from './labels-repo';
import * as checks from './checklists-repo';
import {
    addListAs,
    addCardAs,
    restoreListAs,
    restoreCardAs,
} from './board-writes';
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
    const list = requireChanged(
        await boards.addList(access, board.id, 'Tasks'),
    );
    const card = requireChanged(await boards.addCard(access, list.id, 'Task'));
    const label = requireChanged(
        await labels.createLabel(access, board.id, {
            title: 'Label',
            color: 'red',
        }),
    );
    const checklist = requireChanged(
        await checks.createChecklist(access, card.id, 'Steps'),
    );
    const item = requireChanged(
        await checks.addChecklistItem(access, checklist.id, 'Item'),
    );
    return { owner, editor, board, access, list, card, label, checklist, item };
}

describe('content authorization', () => {
    it('editor saves all content, reorders it and keeps soft delete Undo', async () => {
        const { editor, board, access, list, card, label, checklist, item } =
            await fixture();
        requireChanged(
            await boards.renameList(
                await authorizeList(editor.id, list.id, Action.ContentEdit),
                list.id,
                'Renamed',
            ),
        );
        requireChanged(
            await boards.updateCard(
                await authorizeCard(editor.id, card.id, Action.ContentEdit),
                card.id,
                {
                    title: 'Edited',
                    description: 'Description',
                    completed: true,
                },
            ),
        );
        requireChanged(
            await labels.updateLabel(
                await authorizeLabel(editor.id, label.id, Action.ContentEdit),
                label.id,
                { title: 'Edited label', color: 'blue' },
            ),
        );
        requireChanged(await labels.addCardLabel(access, card.id, label.id));
        requireChanged(
            await checks.renameChecklist(
                await authorizeChecklist(
                    editor.id,
                    checklist.id,
                    Action.ContentEdit,
                ),
                checklist.id,
                'Edited steps',
            ),
        );
        requireChanged(
            await checks.updateChecklistItem(
                await authorizeChecklistItem(
                    editor.id,
                    item.id,
                    Action.ContentEdit,
                ),
                item.id,
                { title: 'Edited item', done: true },
            ),
        );
        const next = requireChanged(
            await checks.addChecklistItem(access, checklist.id, 'Second'),
        );
        requireChanged(
            await checks.moveChecklistItem(access, item.id, next.id, null),
        );
        const target = await addListAs(editor, board.id, 'Target');
        requireChanged(
            await boards.moveCard(access, card.id, target.id, null, null),
        );
        await moveListOrThrow(editor, {
            listId: target.id,
            toBoardId: board.id,
            prevListId: null,
            nextListId: list.id,
        });
        requireChanged(await boards.deleteCard(access, card.id));
        await expect(
            authorizeCard(editor.id, card.id, Action.ContentEdit),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await restoreCardAs(editor, card.id);
        requireChanged(await boards.deleteList(access, target.id));
        await expect(restoreCardAs(editor, card.id)).rejects.toThrow(
            BOARD_ACCESS_DENIED,
        );
        await restoreListAs(editor, target.id);
        const result = await boards.getBoard(access);
        expect(result?.lists[0].cards[0]).toMatchObject({
            title: 'Edited',
            description: 'Description',
            labelIds: [label.id],
            checklistDone: 1,
            checklistTotal: 2,
        });
        expect(
            (await checks.getChecklist(access, card.id))?.items.map(
                (i) => i.title,
            ),
        ).toEqual(['Second', 'Edited item']);
        requireChanged(await labels.removeCardLabel(access, card.id, label.id));
        requireChanged(await labels.deleteLabel(access, label.id));
        requireChanged(await checks.deleteChecklistItem(access, item.id));
        requireChanged(await checks.deleteChecklist(access, checklist.id));
        requireChanged(await boards.deleteList(access, target.id));
        expect((await boards.getBoard(access))?.lists).toHaveLength(1);
    });

    it('removed membership blocks even previously minted passes on every write domain', async () => {
        const { editor, board, access, list, card, label, checklist, item } =
            await fixture();
        await db.delete(boardMembers).where(eq(boardMembers.userId, editor.id));
        for (const gate of [
            () => authorizeList(editor.id, list.id, Action.ContentEdit),
            () => authorizeCard(editor.id, card.id, Action.ContentEdit),
            () =>
                authorizeChecklist(editor.id, checklist.id, Action.ContentEdit),
            () =>
                authorizeChecklistItem(editor.id, item.id, Action.ContentEdit),
        ]) {
            await expect(gate()).rejects.toThrow(BOARD_ACCESS_DENIED);
        }
        for (const write of [
            () => boards.addList(access, board.id, 'Forbidden'),
            () => boards.addCard(access, list.id, 'Forbidden'),
            () => boards.renameList(access, list.id, 'Forbidden'),
            () => boards.deleteList(access, list.id),
            () => boards.restoreList(access, list.id),
            () => boards.updateCard(access, card.id, { title: 'Forbidden' }),
            () => boards.deleteCard(access, card.id),
            () => boards.restoreCard(access, card.id),
            () => boards.moveCard(access, card.id, list.id, null, null),
            () => boards.moveList(access, list.id, access, null, null),
            () =>
                labels.createLabel(access, board.id, {
                    title: 'Forbidden',
                    color: 'red',
                }),
            () =>
                labels.updateLabel(access, label.id, {
                    title: 'Forbidden',
                    color: 'red',
                }),
            () => labels.deleteLabel(access, label.id),
            () => labels.addCardLabel(access, card.id, label.id),
            () => checks.createChecklist(access, card.id, 'Forbidden'),
            () => checks.renameChecklist(access, checklist.id, 'Forbidden'),
            () => checks.deleteChecklist(access, checklist.id),
            () => checks.addChecklistItem(access, checklist.id, 'Forbidden'),
            () => checks.updateChecklistItem(access, item.id, { done: true }),
            () => checks.deleteChecklistItem(access, item.id),
            () => checks.moveChecklistItem(access, item.id, null, null),
        ]) {
            await expect(write().then(requireChanged)).rejects.toThrow(
                BOARD_ACCESS_DENIED,
            );
        }
        await expect(addCardAs(editor, list.id, 'Forbidden')).rejects.toThrow(
            BOARD_ACCESS_DENIED,
        );
        expect(
            (await db.query.cards.findFirst({ where: eq(cards.id, card.id) }))
                ?.title,
        ).toBe('Task');
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
