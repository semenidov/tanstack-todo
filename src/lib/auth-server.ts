import { auth } from '#/lib/auth';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
    return auth.api.getSession({ headers: new Headers(getRequestHeaders()) });
});
