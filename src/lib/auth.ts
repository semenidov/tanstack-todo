import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '#/db';

export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    session: {
        cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
    },
});
