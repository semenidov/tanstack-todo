import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// jsdom and old browsers have no matchMedia: animate as usual there.
const hasMatchMedia = () => typeof window.matchMedia === 'function';

function subscribe(onChange: () => void) {
    if (!hasMatchMedia()) return () => {};
    const query = window.matchMedia(QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

/** True when the user asked the OS for less motion; false on the server. */
export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => hasMatchMedia() && window.matchMedia(QUERY).matches,
        () => false,
    );
}
