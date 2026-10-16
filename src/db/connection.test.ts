import { describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { assertDbReachable, isLocalDatabaseUrl } from './connection';

const LOCAL_URL = 'postgresql://postgres:pw@localhost:5432/test';
const NEON_URL =
    'postgresql://user:pw@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

describe('isLocalDatabaseUrl', () => {
    it.each([
        'postgresql://postgres:pw@localhost:5432/main',
        'postgresql://postgres:pw@127.0.0.1:5432/test',
        'postgres://postgres:pw@[::1]:5432/test',
    ])('treats %s as local', (url) => {
        expect(isLocalDatabaseUrl(url)).toBe(true);
    });

    it('treats a Neon host as remote', () => {
        expect(isLocalDatabaseUrl(NEON_URL)).toBe(false);
    });
});

describe('assertDbReachable', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
    });

    it('resolves when the database answers', async () => {
        const execute = vi.fn().mockResolvedValue({ rows: [] });
        await expect(
            assertDbReachable({ execute }, LOCAL_URL),
        ).resolves.toBeUndefined();
        expect(execute).toHaveBeenCalledWith(sql`select 1`);
    });

    it('fails with the docker compose hint for an unreachable local database', async () => {
        const execute = vi.fn().mockRejectedValue(refused);
        await expect(assertDbReachable({ execute }, LOCAL_URL)).rejects.toThrow(
            /docker compose up -d/,
        );
    });

    it('rethrows the original error for a remote database', async () => {
        const execute = vi.fn().mockRejectedValue(refused);
        await expect(assertDbReachable({ execute }, NEON_URL)).rejects.toBe(
            refused,
        );
    });
});
