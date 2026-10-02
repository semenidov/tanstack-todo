import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** True once rendered on the client (false on the server and during hydration). */
export function useHydrated() {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
}
