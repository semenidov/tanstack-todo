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
        // E2E and the verifier sign up many users from one IP and trip the sign-up
        // limit (429). The Playwright web server and the Vercel Preview env set this
        // flag; production does not have it.
        enabled: process.env.AUTH_RATE_LIMIT_DISABLED !== 'true',
        // Counters in Postgres: in-memory ones live per serverless instance and
        // barely limit anything on Vercel.
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
        // Vercel sets x-forwarded-for to the single client IP. A request without a
        // usable IP is not let through: Better Auth counts it in one shared
        // per-path bucket.
        ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    // Guest sandbox (#84). Signing up from guest mode deletes the guest and its
    // data (plugin default, no transfer).
    plugins: [anonymous({ generateName: () => 'Guest' })],
    databaseHooks: {
        user: {
            create: {
                // Database hook, not hooks.before on the path: here the data
                // says for sure that this is a guest (`isAnonymous`), and the
                // check runs after the plugin's "already a guest" refusal.
                before: async (user) => {
                    if (user.isAnonymous === true) await prepareGuestSignIn();
                },
                after: async (user, context) => {
                    if (user.isAnonymous !== true) return;
                    // The demo board's "Today" is the guest's today (#120).
                    const cookies = context?.headers?.get('cookie');
                    await seedGuest(user.id, timeZoneFromCookies(cookies));
                },
            },
        },
    },
});
