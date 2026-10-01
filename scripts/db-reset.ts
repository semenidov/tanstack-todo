import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';

import { dbHost, isDbResetAllowed } from '../src/lib/db-reset.ts';

// Checked before touching the database (#75).
if (!isDbResetAllowed(process.env)) {
    console.error(
        'db:reset wipes the database. Refusing to run without ALLOW_DB_RESET=1.',
    );
    process.exit(1);
}

// DATABASE_URL only from the process environment, never from `.env*`: the local `.env` may point to prod.
// The following `drizzle-kit migrate` gets the same URL: dotenv in drizzle.config.ts never overrides a set variable.
const url = process.env.DATABASE_URL;
const host = dbHost(url);
if (!url || !host) {
    console.error(
        'db:reset: pass DATABASE_URL explicitly in the environment (.env files are not read).',
    );
    process.exit(1);
}

console.log(`db:reset: dropping schemas "drizzle" and "public" on ${host}`);

const db = drizzle(neon(url));
// `sql`: the query builder has no DDL for dropping/creating schemas.
await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
await db.execute(sql`CREATE SCHEMA public`);

console.log('db:reset: schemas recreated, applying migrations');
