import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '#/db';
import { SIGN_IN_LIMIT, SIGN_UP_LIMIT } from '#/lib/auth-rate-limit';

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
        // E2E signs up many users from one IP and trips the sign-up limit (429).
        // Only the Playwright web server sets this flag.
        enabled: process.env.E2E_DISABLE_RATE_LIMIT !== 'true',
        // Counters in Postgres: in-memory ones live per serverless instance and
        // barely limit anything on Vercel.
        storage: 'database',
        window: 60,
        max: 100,
        customRules: {
            '/sign-in/email': SIGN_IN_LIMIT,
            '/sign-up/email': SIGN_UP_LIMIT,
        },
    },
    advanced: {
        // Vercel sets x-forwarded-for to the single client IP. A request without a
        // usable IP is not let through: Better Auth counts it in one shared
        // per-path bucket.
        ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
});
