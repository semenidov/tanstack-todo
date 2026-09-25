import { requireUserId } from '#/lib/auth-server';
import { createServerFn } from '@tanstack/react-start';
import { setResponseStatus } from '@tanstack/react-start/server';

export const crashServerFn = createServerFn({ method: 'POST' }).handler(
    async () => {
        if (process.env.VERCEL_ENV === 'production') {
            setResponseStatus(404);
            return null;
        }
        await requireUserId();
        throw new Error('Sentry crash test (server)');
    },
);
