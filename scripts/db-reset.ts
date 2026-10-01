import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';

import { dbHost, isDbResetAllowed } from '../src/lib/db-reset.ts';

// Checked before reading env files or touching the database (#75).
if (!isDbResetAllowed(process.env)) {
    console.error(
        'db:reset wipes the database. Refusing to run without ALLOW_DB_RESET=1.',
    );
    process.exit(1);
}

// Same env sources as drizzle.config.ts, so the reset and the following `drizzle-kit migrate` hit one database.
config({ path: ['.env.local', '.env'], quiet: true });

const url = process.env.DATABASE_URL;
const host = dbHost(url);
if (!url || !host) {
    console.error('db:reset: DATABASE_URL is missing or invalid.');
    process.exit(1);
}

console.log(`db:reset: dropping schemas "drizzle" and "public" on ${host}`);

const db = drizzle(neon(url));
// `sql`: the query builder has no DDL for dropping/creating schemas.
await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
await db.execute(sql`CREATE SCHEMA public`);

console.log('db:reset: schemas recreated, applying migrations');
