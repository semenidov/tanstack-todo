import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers, boards } from '#/db/schema';
import { seedUser } from '#/test/db';
import { authorizeInvite, INVITE_INVALID } from './authorize';
import { getInvite, joinBoard } from './members-repo';
import { getInviteServer, joinBoardServer, shareBoardServer } from './members';

const auth = vi.hoisted(() => ({ userId: '' }));
vi.mock('#/lib/auth-server', () => ({
    requireUser: async () => ({ id: auth.userId }),
}));
vi.mock('@tanstack/react-start', () => ({
    createServerFn: () => ({
        validator: () => ({
            handler: (fn: (args: { data: unknown }) => unknown) => fn,
        }),
    }),
}));

async function fixture() {
    const owner = await seedUser({ name: 'Owner' });
    const member = await seedUser();
    const token = 'a'.repeat(64);
    const [board] = await db
        .insert(boards)
        .values({ ownerId: owner.id, title: 'Shared', inviteToken: token })
        .returning();
    auth.userId = member.id;
    return { owner, member, board, token };
}

describe('invitation', () => {
    it('previewing an invitation does not grant membership', async () => {
        const { board, token } = await fixture();

        expect(await getInviteServer({ data: { token } })).toMatchObject({
            boardId: board.id,
            joined: false,
        });
        expect(
            await db
                .select()
                .from(boardMembers)
                .where(eq(boardMembers.boardId, board.id)),
        ).toEqual([]);
    });

    it('concurrent join requests create a single membership', async () => {
        const { board, member, token } = await fixture();

        const results = await Promise.all([
            joinBoardServer({ data: { token } }),
            joinBoardServer({ data: { token } }),
        ]);

        expect(results).toEqual([{ boardId: board.id }, { boardId: board.id }]);
        expect(
            await db
                .select()
                .from(boardMembers)
                .where(eq(boardMembers.boardId, board.id)),
        ).toEqual([expect.objectContaining({ userId: member.id })]);
    });

    it('owner is already joined and never gets a membership row', async () => {
        const { owner, token } = await fixture();
        auth.userId = owner.id;
        expect((await getInviteServer({ data: { token } })).joined).toBe(true);
        await joinBoardServer({ data: { token } });
        expect(await db.select().from(boardMembers)).toHaveLength(0);
    });
    it('resetting the link invalidates an already issued invite pass', async () => {
        const { owner, member, board, token } = await fixture();
        const pass = await authorizeInvite(member.id, token);

        auth.userId = owner.id;
        await shareBoardServer({ data: { boardId: board.id, reset: true } });

        expect(await getInvite(pass)).toBeUndefined();
        expect(await joinBoard(pass)).toEqual([]);
    });

    it('deleting the board invalidates an already issued invite pass', async () => {
        const { member, board, token } = await fixture();
        const pass = await authorizeInvite(member.id, token);

        await db.delete(boards).where(eq(boards.id, board.id));

        expect(await joinBoard(pass)).toEqual([]);
        await expect(getInviteServer({ data: { token } })).rejects.toThrow(
            INVITE_INVALID,
        );
    });

    it('guest can join using the same handler', async () => {
        const { token } = await fixture();
        const guest = await seedUser({ isAnonymous: true });
        auth.userId = guest.id;
        await joinBoardServer({ data: { token } });
        expect((await db.select().from(boardMembers))[0].userId).toBe(guest.id);
    });
});
