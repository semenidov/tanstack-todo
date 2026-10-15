// Type-level check, verified by `npm run typecheck` (not run by vitest).
// neon-http has no interactive transactions and pg has no `batch`: the shared
// `db` type must expose neither, so code that works locally (pg) cannot break
// on Vercel (neon-http).
import type { Db } from './index';

declare const db: Db;

// @ts-expect-error -- `transaction` is not available on neon-http
void db.transaction;
// @ts-expect-error -- `batch` is not available on node-postgres
void db.batch;
