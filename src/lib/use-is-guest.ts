import { useRouteContext } from '@tanstack/react-router';

/** Whether the signed-in user is a guest (#84), from the session in the root route context. */
export function useIsGuest() {
    return useRouteContext({
        from: '__root__',
        select: (context) => context.session?.user.isAnonymous === true,
    });
}
