import { useRouteContext } from '@tanstack/react-router';

export function useIsGuest() {
    return useRouteContext({
        from: '__root__',
        select: (context) => context.session?.user.isAnonymous === true,
    });
}
