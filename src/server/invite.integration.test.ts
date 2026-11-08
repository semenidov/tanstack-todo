import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#/db';
import { boardMembers, boards } from '#/db/schema';
import { seedUser } from '#/test/db';
import { authorizeInvite, INVITE_INVALID } from './authorize';
import { getInvite, joinBoard } from './members-repo';
import { getInviteServer, joinBoardServer } from './members';

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
    it('preview grants no membership; repeated and concurrent Join insert once', async () => {
        const { board, token } = await fixture();
        const preview = await getInviteServer({ data: { token } });
        expect(preview).toEqual({
            boardId: board.id,
            title: 'Shared',
            ownerName: 'Owner',
            joined: false,
        });
        expect(await db.select().from(boardMembers)).toHaveLength(0);
        await Promise.all([
            joinBoardServer({ data: { token } }),
            joinBoardServer({ data: { token } }),
        ]);
        expect(await joinBoardServer({ data: { token } })).toEqual({
            boardId: board.id,
        });
        expect(await db.select().from(boardMembers)).toHaveLength(1);
        expect((await getInviteServer({ data: { token } })).joined).toBe(true);
    });
    it('owner is already joined and never gets a membership row', async () => {
        const { owner, token } = await fixture();
        auth.userId = owner.id;
        expect((await getInviteServer({ data: { token } })).joined).toBe(true);
        await joinBoardServer({ data: { token } });
        expect(await db.select().from(boardMembers)).toHaveLength(0);
    });
    it('rejects stale passes after reset and deletion, and invalid tokens', async () => {
        const { member, board, token } = await fixture();
        const pass = await authorizeInvite(member.id, token);
        await db
            .update(boards)
            .set({ inviteToken: 'b'.repeat(64) })
            .where(eq(boards.id, board.id));
        expect(await joinBoard(pass)).toEqual([]);
        expect(await getInvite(pass)).toBeUndefined();
        await expect(joinBoardServer({ data: { token } })).rejects.toThrow(
            INVITE_INVALID,
        );
        await expect(
            getInviteServer({ data: { token: 'invalid' } }),
        ).rejects.toThrow(INVITE_INVALID);
        const current = await authorizeInvite(member.id, 'b'.repeat(64));
        await db.delete(boards).where(eq(boards.id, board.id));
        expect(await joinBoard(current)).toEqual([]);
        await expect(
            getInviteServer({ data: { token: 'b'.repeat(64) } }),
        ).rejects.toThrow(INVITE_INVALID);
    });
    it('guest can join using the same handler', async () => {
        const { token } = await fixture();
        const guest = await seedUser({ isAnonymous: true });
        auth.userId = guest.id;
        await joinBoardServer({ data: { token } });
        expect((await db.select().from(boardMembers))[0].userId).toBe(guest.id);
    });
});
