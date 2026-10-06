import { auth } from '#/lib/auth';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

export const getSession = createServerFn({ method: 'GET' }).handler(
    async () => {
        return auth.api.getSession({
            headers: new Headers(getRequestHeaders()),
        });
    },
);

/** The session user as the board server fns need it: id and guest flag (#84). */
export interface SessionUser {
    id: string;
    isAnonymous: boolean;
}

export const requireUser = createServerFn({ method: 'GET' }).handler(
    async (): Promise<SessionUser> => {
        const session = await auth.api.getSession({
            headers: new Headers(getRequestHeaders()),
        });
        if (!session) throw new Error('Unauthorized');
        return {
            id: session.user.id,
            isAnonymous: session.user.isAnonymous === true,
        };
    },
);

export const requireUserId = createServerFn({ method: 'GET' }).handler(
    async () => {
        const session = await auth.api.getSession({
            headers: new Headers(getRequestHeaders()),
        });
        if (!session) throw new Error('Unauthorized');
        return session.user.id;
    },
);
