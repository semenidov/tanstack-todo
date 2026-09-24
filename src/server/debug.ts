import { requireUserId } from '#/lib/auth-server';
import { createServerFn } from '@tanstack/react-start';

export const crashServerFn = createServerFn({ method: 'POST' }).handler(
    async () => {
        await requireUserId();
        throw new Error('Sentry crash test (server)');
    },
);
