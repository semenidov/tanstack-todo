import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#/db';
import { boards, cards, lists, session, user } from '#/db/schema';
import { DEMO_BOARD } from '#/lib/demo-board';
import { GUEST_CAP_CODE } from '#/lib/guest';
import { MAX_ACTIVE_GUESTS } from '#/lib/quotas';
import { addCardAs, addListAs, createBoardAs } from '#/server/board-writes';
import { getBoard } from '#/server/boards-repo';
import { seedUser } from '#/test/db';
import { count, eq, inArray, sql } from 'drizzle-orm';

const sentry = vi.hoisted(() => ({
    captureMessage: vi.fn(),
    captureException: vi.fn(),
}));
vi.mock('@sentry/tanstackstart-react', () => sentry);

const { auth } = await import('#/lib/auth');

const ORIGIN = 'http://localhost:3000';
const DAY_MS = 24 * 60 * 60 * 1000;

function post(path: string, cookie?: string) {
    const headers = new Headers({
        'content-type': 'application/json',
        origin: ORIGIN,
    });
    if (cookie) headers.set('cookie', cookie);
    return auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
            method: 'POST',
            headers,
            body: '{}',
        }),
    );
}

async function signInAsGuest() {
    const res = await post('/sign-in/anonymous');
    const cookie = res.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ');
    return { res, cookie };
}

function daysAgo(days: number) {
    return new Date(Date.now() - days * DAY_MS);
}

async function seedGuest(createdAt: Date) {
    return seedUser({ name: 'Guest', isAnonymous: true, createdAt });
}

/** A board with one list and one card, to check the cascade. */
async function seedContent(ownerId: string) {
    const [board] = await db
        .insert(boards)
        .values({ ownerId, title: 'Board' })
        .returning();
    const [list] = await db
        .insert(lists)
        .values({ boardId: board.id, title: 'List' })
        .returning();
    const [card] = await db
        .insert(cards)
        .values({ listId: list.id, title: 'Card', position: 'a0' })
        .returning();
    return { board, list, card };
}

async function seedSession(userId: string) {
    await db.insert(session).values({
        id: randomUUID(),
        token: randomUUID(),
        userId,
        expiresAt: new Date(Date.now() + DAY_MS),
        updatedAt: new Date(),
    });
}

async function userIds() {
    const rows = await db.select({ id: user.id }).from(user);
    return rows.map((r) => r.id);
}

async function guestCount() {
    const [row] = await db
        .select({ n: count() })
        .from(user)
        .where(eq(user.isAnonymous, true));
    return row.n;
}

beforeEach(async () => {
    vi.clearAllMocks();
    // Guest sign-in is rate limited per IP (all requests here share one), and
    // rate_limit is not linked to "user", so the global truncate skips it.
    // sql: drizzle has no truncate in the query builder.
    await db.execute(sql`truncate table "rate_limit"`);
});

describe('guest sign-in', () => {
    it('creates a guest with the demo board in the given order', async () => {
        const { res } = await signInAsGuest();
        expect(res.status).toBe(200);
        const body: { user: { id: string; name: string } } = await res.json();

        const [guest] = await db
            .select()
            .from(user)
            .where(eq(user.id, body.user.id));
        expect(guest.isAnonymous).toBe(true);
        expect(guest.name).toBe('Guest');

        const owned = await db
            .select()
            .from(boards)
            .where(eq(boards.ownerId, guest.id));
        expect(owned).toHaveLength(1);
        const demo = await getBoard(guest.id, owned[0].id);
        expect(demo?.board.title).toBe('Todo app roadmap');
        expect(
            demo?.lists.map((l) => ({
                title: l.title,
                cards: l.cards.map((c) => ({
                    title: c.title,
                    description: c.description,
                })),
            })),
        ).toEqual(DEMO_BOARD.lists);
        expect(demo?.lists[1].cards[0].title).toBe(
            '👋 Try me: drag this card to Done',
        );
    });

    it('deletes only guests older than 7 days, with their data', async () => {
        const expired = await seedGuest(daysAgo(8));
        const fresh = await seedGuest(daysAgo(6));
        const regular = await seedUser({ createdAt: daysAgo(30) });
        const expiredContent = await seedContent(expired.id);
        await seedContent(fresh.id);
        await seedContent(regular.id);
        await seedSession(expired.id);
        await seedSession(regular.id);

        const { res } = await signInAsGuest();
        expect(res.status).toBe(200);

        const ids = await userIds();
        expect(ids).not.toContain(expired.id);
        expect(ids).toContain(fresh.id);
        expect(ids).toContain(regular.id);
        expect(
            await db
                .select()
                .from(boards)
                .where(eq(boards.id, expiredContent.board.id)),
        ).toEqual([]);
        expect(
            await db
                .select()
                .from(lists)
                .where(eq(lists.id, expiredContent.list.id)),
        ).toEqual([]);
        expect(
            await db
                .select()
                .from(cards)
                .where(eq(cards.id, expiredContent.card.id)),
        ).toEqual([]);
        const sessions = await db
            .select({ userId: session.userId })
            .from(session)
            .where(inArray(session.userId, [expired.id, regular.id]));
        expect(sessions).toEqual([{ userId: regular.id }]);
        const regularBoards = await db
            .select()
            .from(boards)
            .where(inArray(boards.ownerId, [fresh.id, regular.id]));
        expect(regularBoards).toHaveLength(2);
    });

    it(`refuses the guest after ${MAX_ACTIVE_GUESTS} active ones and reports it`, async () => {
        await db.insert(user).values(
            Array.from({ length: MAX_ACTIVE_GUESTS }, () => {
                const id = randomUUID();
                return {
                    id,
                    name: 'Guest',
                    email: `${id}@example.com`,
                    isAnonymous: true,
                    createdAt: daysAgo(1),
                };
            }),
        );

        const { res } = await signInAsGuest();
        expect(res.status).toBe(503);
        const body: { code?: string } = await res.json();
        expect(body.code).toBe(GUEST_CAP_CODE);
        expect(await guestCount()).toBe(MAX_ACTIVE_GUESTS);
        expect(sentry.captureMessage).toHaveBeenCalledWith(
            'Guest cap reached',
            'warning',
        );
    });

    it('does not count expired guests towards the cap', async () => {
        await db.insert(user).values(
            Array.from({ length: MAX_ACTIVE_GUESTS }, (_, i) => {
                const id = randomUUID();
                return {
                    id,
                    name: 'Guest',
                    email: `${id}@example.com`,
                    isAnonymous: true,
                    // One of them is past the TTL and is removed first.
                    createdAt: daysAgo(i === 0 ? 8 : 1),
                };
            }),
        );

        const { res } = await signInAsGuest();
        expect(res.status).toBe(200);
        expect(await guestCount()).toBe(MAX_ACTIVE_GUESTS);
        expect(sentry.captureMessage).not.toHaveBeenCalled();
    });

    it('does not count regular users towards the cap', async () => {
        await db.insert(user).values(
            Array.from({ length: MAX_ACTIVE_GUESTS }, () => {
                const id = randomUUID();
                return { id, name: 'User', email: `${id}@example.com` };
            }),
        );

        const { res } = await signInAsGuest();
        expect(res.status).toBe(200);
    });
});

describe('guest sign-out', () => {
    it('deletes the guest and all of its data', async () => {
        const { res, cookie } = await signInAsGuest();
        const body: { user: { id: string } } = await res.json();
        const guestId = body.user.id;

        const out = await post('/delete-anonymous-user', cookie);
        expect(out.status).toBe(200);

        expect(await userIds()).not.toContain(guestId);
        expect(
            await db.select().from(boards).where(eq(boards.ownerId, guestId)),
        ).toEqual([]);
        expect(
            await db.select().from(session).where(eq(session.userId, guestId)),
        ).toEqual([]);
        // Lists and cards of the demo board went with it (nothing else exists).
        expect(await db.select().from(lists)).toEqual([]);
        expect(await db.select().from(cards)).toEqual([]);
    });
});

// The session cookie cache (5 min) can still carry a guest that was deleted
// (expired, or signed out in another tab).
describe('deleted guest with a cached session', () => {
    it('is refused as unauthorized, nothing is inserted', async () => {
        const row = await seedGuest(daysAgo(1));
        const { board, list } = await seedContent(row.id);
        await db.delete(user).where(eq(user.id, row.id));
        const deleted = { id: row.id, isAnonymous: true };

        await expect(createBoardAs(deleted, 'After delete')).rejects.toThrow(
            /^Unauthorized$/,
        );
        // Its boards went with it, so these find nothing to insert into.
        expect(await addListAs(deleted, board.id, 'After delete')).toBeNull();
        expect(await addCardAs(deleted, list.id, 'After delete')).toBeNull();
        expect(
            await db.select().from(boards).where(eq(boards.ownerId, row.id)),
        ).toEqual([]);
    });
});
