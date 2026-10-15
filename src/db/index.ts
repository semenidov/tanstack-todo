import { neon } from '@neondatabase/serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { isLocalDatabaseUrl } from './connection.ts';
import * as schema from './schema.ts';

/**
 * What both drivers support. No `transaction` (neon-http has none) and no
 * `batch` (pg has none): code that runs locally must also run on Vercel.
 */
export type Db = Omit<
    PgDatabase<PgQueryResultHKT, typeof schema>,
    'transaction'
> & {
    // Raw driver, for static SQL files only (migration tests).
    $client: { query: (text: string) => Promise<unknown> };
};

declare global {
    // One pg pool per process: vite dev re-evaluates this module on HMR.
    var __localPgPool: Pool | undefined;
}

const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error(
        'DATABASE_URL is not set (missing .env / .env.test / .env.e2e?)',
    );
}

function localPool(connectionString: string): Pool {
    globalThis.__localPgPool ??= new Pool({
        connectionString,
        // A stopped container refuses at once; this bounds other failures.
        connectionTimeoutMillis: 5000,
        // Idle connections must not keep test runners and scripts alive.
        allowExitOnIdle: true,
    });
    return globalThis.__localPgPool;
}

export const databaseUrl = url;

export const db: Db = isLocalDatabaseUrl(url)
    ? drizzlePg(localPool(url), { schema })
    : drizzleNeon(neon(url), { schema });
