import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';
import { db } from '#/db';
import {
    GUEST_SIGN_IN_LIMIT,
    SIGN_IN_LIMIT,
    SIGN_UP_LIMIT,
} from '#/lib/auth-rate-limit';
import { prepareGuestSignIn, seedGuest } from '#/server/guests';
import { timeZoneFromCookies } from '#/lib/time-zone';

const PROD_HOST = 'todo-semenidov.vercel.app';
const PREVIEW_HOSTS = ['tanstack-todo-*-ssemenidov.vercel.app'];
const LOCAL_HOSTS = ['localhost:3000', '127.0.0.1:3100'];

const onVercel = !!process.env.VERCEL;
const isPreview = process.env.VERCEL_ENV === 'preview';

export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    baseURL: {
        allowedHosts: [
            PROD_HOST,
            ...(isPreview ? PREVIEW_HOSTS : []),
            ...(onVercel ? [] : LOCAL_HOSTS),
        ],
        fallback: `https://${PROD_HOST}`,
        protocol: onVercel ? 'https' : 'http',
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    session: {
        cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
        enabled: process.env.AUTH_RATE_LIMIT_DISABLED !== 'true',
        storage: 'database',
        window: 60,
        max: 100,
        customRules: {
            '/sign-in/email': SIGN_IN_LIMIT,
            '/sign-up/email': SIGN_UP_LIMIT,
            '/sign-in/anonymous': GUEST_SIGN_IN_LIMIT,
        },
    },
    advanced: {
        ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    plugins: [anonymous({ generateName: () => 'Guest' })],
    databaseHooks: {
        user: {
            create: {
                // Database hook: only here `isAnonymous` is known for sure, after the
                // plugin's "already a guest" refusal.
                before: async (user) => {
                    if (user.isAnonymous === true) await prepareGuestSignIn();
                },
                after: async (user, context) => {
                    if (user.isAnonymous !== true) return;
                    const cookies = context?.headers?.get('cookie');
                    await seedGuest(user.id, timeZoneFromCookies(cookies));
                },
            },
        },
    },
});
