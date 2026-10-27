import { neon } from '@neondatabase/serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { isLocalDatabaseUrl } from './connection.ts';
import * as schema from './schema.ts';

export type Db = Omit<
    PgDatabase<PgQueryResultHKT, typeof schema>,
    'transaction'
> & {
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
        connectionTimeoutMillis: 5000,
        allowExitOnIdle: true,
    });
    return globalThis.__localPgPool;
}

export const databaseUrl = url;

export const db: Db = isLocalDatabaseUrl(url)
    ? drizzlePg(localPool(url), { schema })
    : drizzleNeon(neon(url), { schema });
