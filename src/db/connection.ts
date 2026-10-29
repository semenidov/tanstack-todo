import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalDatabaseUrl(url: string): boolean {
    return LOCAL_HOSTS.has(new URL(url).hostname);
}

export const LOCAL_DB_UNREACHABLE_HINT =
    'Local Postgres is unreachable. Start it with `docker compose up -d` ' +
    '(and run migrations on a fresh volume, see CONTRIBUTING.md).';

export async function assertDbReachable(
    db: { execute: (query: SQL) => Promise<unknown> },
    url: string,
): Promise<void> {
    try {
        await db.execute(sql`select 1`);
    } catch (error) {
        if (!isLocalDatabaseUrl(url)) throw error;
        throw new Error(LOCAL_DB_UNREACHABLE_HINT, { cause: error });
    }
}
