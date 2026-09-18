import { auth } from '#/lib/auth';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
    return auth.api.getSession({ headers: new Headers(getRequestHeaders()) });
});

export const requireUserId = createServerFn({ method: 'GET' }).handler(
    async () => {
        const session = await auth.api.getSession({
            headers: new Headers(getRequestHeaders()),
        });
        if (!session) throw new Error('Unauthorized');
        return session.user.id;
    },
);
