import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '#/db';

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
        enabled: true,
        window: 60,
        max: 100,
    },
});
