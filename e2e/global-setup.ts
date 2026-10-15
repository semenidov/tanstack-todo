import { databaseUrl, db } from '../src/db';
import { assertDbReachable } from '../src/db/connection';

// Fail the run at once (with the docker hint locally), not every test on a timeout.
export default async function globalSetup() {
    await assertDbReachable(db, databaseUrl);
}
