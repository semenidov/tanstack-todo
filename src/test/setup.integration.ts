import './load-test-env';
import { sql } from 'drizzle-orm';
import { beforeEach } from 'vitest';
import { databaseUrl, db } from '#/db';
import { assertDbReachable } from '#/db/connection';

if (process.env.TEST_DB !== '1') {
    throw new Error(
        'Integration tests aborted: .env.test must set TEST_DB=1 ' +
            '(guard against truncating a non-test database).',
    );
}

await assertDbReachable(db, databaseUrl);

beforeEach(async () => {
    await db.execute(sql`truncate table "user" restart identity cascade`);
});
