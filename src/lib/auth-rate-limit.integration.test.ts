import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#/db';
import { rateLimit } from '#/db/schema';
import { sql } from 'drizzle-orm';

// Under NODE_ENV=test (or TEST=true) Better Auth replaces a missing client IP with
// 127.0.0.1. This file checks the production path, so it runs without those flags.
// Hoisted: Better Auth reads NODE_ENV once, when its module is first imported.
vi.hoisted(() => {
    process.env.NODE_ENV = 'integration';
    delete process.env.TEST;
});

const { auth } = await import('#/lib/auth');

const ORIGIN = 'http://localhost:3000';

function post(path: string, body: unknown, ip?: string) {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (ip) headers.set('x-forwarded-for', ip);
    return auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        }),
    );
}

function signIn(ip?: string) {
    return post(
        '/sign-in/email',
        { email: 'nobody@example.com', password: 'wrong-password' },
        ip,
    );
}

function signUp(ip?: string) {
    return post(
        '/sign-up/email',
        {
            name: 'Test User',
            email: `${randomUUID()}@example.com`,
            password: 'password-123',
        },
        ip,
    );
}

/** Statuses of `count` sequential calls (sequential: each one sees the previous counter). */
async function statuses(count: number, call: () => Promise<Response>) {
    const result: Array<number> = [];
    for (let i = 0; i < count; i++) result.push((await call()).status);
    return result;
}

async function counterRow(key: string) {
    const rows = await db.select().from(rateLimit);
    return rows.find((r) => r.key === key);
}

beforeEach(async () => {
    // Not linked to "user", so the global truncate does not clear it.
    // sql: drizzle has no truncate in the query builder.
    await db.execute(sql`truncate table "rate_limit"`);
});

describe('auth rate limit', () => {
    it('lets 5 sign-in attempts from one IP through and answers 429 to the 6th', async () => {
        const ip = '203.0.113.10';

        const first = await statuses(5, () => signIn(ip));
        expect(first).not.toContain(429);
        expect((await signIn(ip)).status).toBe(429);
    });

    it('keeps the counters in the database', async () => {
        const ip = '203.0.113.11';

        await statuses(2, () => signIn(ip));
        expect((await counterRow(`${ip}|/sign-in/email`))?.count).toBe(2);
    });

    it('applies counters written by another instance', async () => {
        const ip = '203.0.113.12';
        // Another serverless instance already used up the limit for this IP.
        await db.insert(rateLimit).values({
            id: randomUUID(),
            key: `${ip}|/sign-in/email`,
            count: 5,
            lastRequest: Date.now(),
        });

        expect((await signIn(ip)).status).toBe(429);
    });

    it('does not block one IP because of another', async () => {
        await statuses(6, () => signIn('203.0.113.13'));

        expect((await signIn('203.0.113.14')).status).not.toBe(429);
    });

    it('counts requests without an IP in one shared bucket instead of skipping the limit', async () => {
        const first = await statuses(5, () => signIn());
        expect(first).not.toContain(429);
        expect((await signIn()).status).toBe(429);
        expect((await counterRow('no-trusted-ip|/sign-in/email'))?.count).toBe(
            5,
        );
    });

    it('lets 3 sign-ups from one IP through and answers 429 to the 4th, for 10 minutes', async () => {
        const ip = '203.0.113.15';

        const first = await statuses(3, () => signUp(ip));
        expect(first).not.toContain(429);
        const blocked = await signUp(ip);
        expect(blocked.status).toBe(429);
        expect(Number(blocked.headers.get('X-Retry-After'))).toBeGreaterThan(
            60,
        );
    });

    it('keeps the general limit of 100 per minute for other auth routes', async () => {
        const ip = '203.0.113.16';
        const key = `${ip}|/sign-out`;
        await db.insert(rateLimit).values({
            id: randomUUID(),
            key,
            count: 98,
            lastRequest: Date.now(),
        });

        expect(
            await statuses(2, () => post('/sign-out', {}, ip)),
        ).not.toContain(429);
        expect((await post('/sign-out', {}, ip)).status).toBe(429);
    });
});
