import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// Hosts of the local Docker Postgres (`compose.yaml`). Node's URL keeps the
// brackets of an IPv6 hostname.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Local Docker Postgres goes through `pg`, anything else (Neon) through `neon-http`. */
export function isLocalDatabaseUrl(url: string): boolean {
    return LOCAL_HOSTS.has(new URL(url).hostname);
}

export const LOCAL_DB_UNREACHABLE_HINT =
    'Local Postgres is unreachable. Start it with `docker compose up -d` ' +
    '(and run migrations on a fresh volume, see CONTRIBUTING.md).';

/**
 * Fails fast before a test run instead of every test timing out on its own.
 * For a local database the error carries the `docker compose up -d` hint.
 */
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
