import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers } from '#/db/schema';
import { Action } from '#/lib/permissions';
import { seedUser } from '#/test/db';
import {
    authorizeBoard,
    authorizeList,
    authorizeCard,
    authorizeChecklist,
    authorizeChecklistItem,
    requireAffected,
    BOARD_ACCESS_DENIED,
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
import { moveCardOrThrow } from './move-card';

async function fixture() {
    const owner = await seedUser();
    const member = await seedUser();
    const outsider = await seedUser();
    const board = await boards.createBoard(owner.id, 'Shared');
    await db
        .insert(boardMembers)
        .values({ boardId: board.id, userId: member.id });
    const access = await authorizeBoard(member, board.id, Action.ContentEdit);
    return { owner, member, outsider, board, access };
}

describe('shared content writes', () => {
    it('persists member additions, edits, ordering, moves, labels, checklist items, deletion and Undo', async () => {
        const { member, board, access } = await fixture();
        const user = { ...member, isAnonymous: false };
        const list = await addListAs(user, board.id, 'First');
        const target = await addListAs(user, board.id, 'Second');
        await boards.renameList(
            await authorizeList(user, list.id, Action.ContentEdit),
            list.id,
            'Renamed',
        );
        await moveListOrThrow(user, {
            listId: target.id,
            toBoardId: board.id,
            prevListId: null,
            nextListId: list.id,
        });
        const card = await addCardAs(user, list.id, 'Card');
        await boards.updateCard(
            await authorizeCard(user, card.id, Action.ContentEdit),
            card.id,
            { title: 'Edited', description: 'Member text', completed: true },
        );
        await moveCardOrThrow(user, {
            cardId: card.id,
            toListId: target.id,
            prevCardId: null,
            nextCardId: null,
        });
        const label = requireAffected(
            await labels.createLabel(access, board.id, {
                title: 'Label',
                color: 'red',
            }),
        );
        await labels.updateLabel(access, label.id, {
            title: 'Edited label',
            color: 'blue',
        });
        await labels.addCardLabel(access, card.id, label.id);
        const checklist = requireAffected(
            await checks.createChecklist(access, card.id, 'Steps'),
        );
        const checklistAccess = await authorizeChecklist(
            user,
            checklist.id,
            Action.ContentEdit,
        );
        await checks.renameChecklist(
            checklistAccess,
            checklist.id,
            'Edited steps',
        );
        const a = requireAffected(
            await checks.addChecklistItem(checklistAccess, checklist.id, 'A'),
        );
        const b = requireAffected(
            await checks.addChecklistItem(checklistAccess, checklist.id, 'B'),
        );
        await checks.updateChecklistItem(
            await authorizeChecklistItem(user, a.id, Action.ContentEdit),
            a.id,
            { title: 'Edited A', done: true },
        );
        await checks.moveChecklistItem(access, b.id, null, a.id);
        const persisted = requireAffected(await boards.getBoard(access));
        expect(persisted.lists.map((l) => l.title)).toEqual([
            'Second',
            'Renamed',
        ]);
        expect(persisted.lists[0].cards[0]).toMatchObject({
            id: card.id,
            title: 'Edited',
            description: 'Member text',
            labelIds: [label.id],
            checklistDone: 1,
            checklistTotal: 2,
        });
        expect(
            (await checks.getChecklist(access, card.id))?.items.map(
                (i) => i.title,
            ),
        ).toEqual(['B', 'Edited A']);
        expect((await labels.listLabels(access))[0].title).toBe('Edited label');
        await checks.deleteChecklistItem(access, b.id);
        await checks.deleteChecklist(access, checklist.id);
        await labels.removeCardLabel(access, card.id, label.id);
        await labels.deleteLabel(access, label.id);
        expect(await checks.getChecklist(access, card.id)).toBeNull();
        expect(await labels.listLabels(access)).toEqual([]);
        await boards.deleteCard(access, card.id);
        await expect(
            authorizeCard(user, card.id, Action.ContentEdit),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await restoreCardAs(user, card.id);
        await boards.deleteList(access, target.id);
        await expect(
            authorizeCard(user, card.id, Action.ContentEdit),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(restoreCardAs(user, card.id)).rejects.toThrow(
            BOARD_ACCESS_DENIED,
        );
        await restoreListAs(user, target.id);
        expect((await boards.getBoard(access))?.lists[0].cards[0].id).toBe(
            card.id,
        );
    });

    it('denies outsiders and removed members, including stale passes and zero affected rows', async () => {
        const { member, outsider, board, access } = await fixture();
        const list = requireAffected(
            await boards.addList(access, board.id, 'List'),
        );
        const card = requireAffected(
            await boards.addCard(access, list.id, 'Card'),
        );
        const label = requireAffected(
            await labels.createLabel(access, board.id, {
                title: 'Label',
                color: 'red',
            }),
        );
        const checklist = requireAffected(
            await checks.createChecklist(access, card.id, 'Steps'),
        );
        const item = requireAffected(
            await checks.addChecklistItem(access, checklist.id, 'A'),
        );
        await expect(
            authorizeList(outsider, list.id, Action.ContentEdit),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await db.delete(boardMembers).where(eq(boardMembers.userId, member.id));
        for (const operation of [
            () => authorizeCard(member, card.id, Action.ContentEdit),
            () => authorizeChecklist(member, checklist.id, Action.ContentEdit),
            () => authorizeChecklistItem(member, item.id, Action.ContentEdit),
        ])
            await expect(operation()).rejects.toThrow(BOARD_ACCESS_DENIED);
        for (const operation of [
            () => boards.addList(access, board.id, 'Denied'),
            () => boards.addCard(access, list.id, 'Denied'),
            () => boards.renameList(access, list.id, 'Denied'),
            () => boards.updateCard(access, card.id, { title: 'Denied' }),
            () => boards.moveCard(access, card.id, list.id, null, null),
            () =>
                boards.moveList(access, list.id, access, board.id, null, null),
            () =>
                labels.createLabel(access, board.id, {
                    title: 'Denied',
                    color: 'red',
                }),
            () =>
                labels.updateLabel(access, label.id, {
                    title: 'Denied',
                    color: 'red',
                }),
            () => labels.addCardLabel(access, card.id, label.id),
            () => checks.createChecklist(access, card.id, 'Denied'),
            () => checks.addChecklistItem(access, checklist.id, 'Denied'),
            () => checks.updateChecklistItem(access, item.id, { done: true }),
        ])
            await expect(operation().then(requireAffected)).rejects.toThrow(
                BOARD_ACCESS_DENIED,
            );
    });

    it('binds label and checklist IDs to the pass and rejects content of a deleted parent', async () => {
        const { owner, member, board, access } = await fixture();
        const list = requireAffected(
            await boards.addList(access, board.id, 'List'),
        );
        const card = requireAffected(
            await boards.addCard(access, list.id, 'Card'),
        );
        const label = requireAffected(
            await labels.createLabel(access, board.id, {
                title: 'Label',
                color: 'red',
            }),
        );
        const checklist = requireAffected(
            await checks.createChecklist(access, card.id, 'Steps'),
        );
        const item = requireAffected(
            await checks.addChecklistItem(access, checklist.id, 'A'),
        );
        const other = await boards.createBoard(owner.id, 'Other');
        const otherAccess = await authorizeBoard(
            owner,
            other.id,
            Action.ContentEdit,
        );
        for (const operation of [
            () =>
                labels.updateLabel(otherAccess, label.id, {
                    title: 'Denied',
                    color: 'red',
                }),
            () => labels.deleteLabel(otherAccess, label.id),
            () => labels.addCardLabel(otherAccess, card.id, label.id),
            () => checks.renameChecklist(otherAccess, checklist.id, 'Denied'),
            () => checks.deleteChecklist(otherAccess, checklist.id),
            () =>
                checks.updateChecklistItem(otherAccess, item.id, {
                    done: true,
                }),
        ])
            await expect(operation().then(requireAffected)).rejects.toThrow(
                BOARD_ACCESS_DENIED,
            );
        await boards.deleteList(access, list.id);
        await expect(
            authorizeChecklist(member, checklist.id, Action.ContentEdit),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            authorizeChecklistItem(member, item.id, Action.ContentEdit),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            checks
                .renameChecklist(access, checklist.id, 'Hidden')
                .then(requireAffected),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            checks
                .updateChecklistItem(access, item.id, { done: true })
                .then(requireAffected),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            labels
                .addCardLabel(access, card.id, label.id)
                .then(requireAffected),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        await expect(
            boards.renameList(access, list.id, 'Hidden').then(requireAffected),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
    });

    it('requires owner permissions on both sides of a cross-board list move and for board management', async () => {
        const { owner, member, board, access } = await fixture();
        const list = requireAffected(
            await boards.addList(access, board.id, 'List'),
        );
        const ownedByMember = await boards.createBoard(member.id, 'Personal');
        const input = {
            listId: list.id,
            toBoardId: ownedByMember.id,
            prevListId: null,
            nextListId: null,
        };
        await expect(
            moveListOrThrow({ ...member, isAnonymous: false }, input),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        const memberAccess = await authorizeBoard(
            member,
            ownedByMember.id,
            Action.ContentEdit,
        );
        const ownList = requireAffected(
            await boards.addList(memberAccess, ownedByMember.id, 'Own'),
        );
        await expect(
            moveListOrThrow(
                { ...member, isAnonymous: false },
                { ...input, listId: ownList.id, toBoardId: board.id },
            ),
        ).rejects.toThrow(BOARD_ACCESS_DENIED);
        for (const action of [Action.BoardRename, Action.BoardDelete])
            await expect(
                authorizeBoard(member, board.id, action),
            ).rejects.toThrow(BOARD_ACCESS_DENIED);
        const target = await boards.createBoard(owner.id, 'Owner target');
        await moveListOrThrow(
            { ...owner, isAnonymous: false },
            { ...input, toBoardId: target.id },
        );
        expect(
            (
                await boards.getBoard(
                    await authorizeBoard(owner, target.id, Action.BoardRead),
                )
            )?.lists[0].id,
        ).toBe(list.id);
    });
});
