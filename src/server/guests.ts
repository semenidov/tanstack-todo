import { db } from '#/db';
import { user } from '#/db/schema';
import { GUEST_CAP_CODE, GUEST_CAP_MESSAGE } from '#/lib/guest';
import { GUEST_TTL_DAYS, MAX_ACTIVE_GUESTS } from '#/lib/quotas';
import { seedDemoBoard } from '#/server/boards-repo';
import * as Sentry from '@sentry/tanstackstart-react';
import { APIError } from 'better-auth/api';
import { and, count, eq, lt } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

function expiryCutoff(now: Date) {
    return new Date(now.getTime() - GUEST_TTL_DAYS * DAY_MS);
}

/** Both conditions are required: without `isAnonymous` this deletes real accounts. */
export function deleteExpiredGuests(now = new Date()) {
    return db
        .delete(user)
        .where(
            and(
                eq(user.isAnonymous, true),
                lt(user.createdAt, expiryCutoff(now)),
            ),
        )
        .returning({ id: user.id });
}

export async function prepareGuestSignIn(now = new Date()) {
    await deleteExpiredGuests(now);
    const [{ n }] = await db
        .select({ n: count() })
        .from(user)
        .where(eq(user.isAnonymous, true));
    if (n >= MAX_ACTIVE_GUESTS) {
        Sentry.captureMessage('Guest cap reached', 'warning');
        throw new APIError('SERVICE_UNAVAILABLE', {
            code: GUEST_CAP_CODE,
            message: GUEST_CAP_MESSAGE,
        });
    }
}

export async function seedGuest(userId: string, timeZone: string) {
    try {
        await seedDemoBoard(userId, timeZone);
    } catch (error) {
        Sentry.captureException(error);
        console.error('Demo board seeding failed', error);
    }
}
