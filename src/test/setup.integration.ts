import './load-test-env';
import { sql } from 'drizzle-orm';
import { beforeEach } from 'vitest';
import { db } from '#/db';

if (process.env.TEST_DB !== '1') {
    throw new Error(
        'Integration tests aborted: .env.test must set TEST_DB=1 ' +
            '(guard against truncating a non-test database).',
    );
}

beforeEach(async () => {
    await db.execute(
        sql`truncate table "todos", "user" restart identity cascade`,
    );
});
