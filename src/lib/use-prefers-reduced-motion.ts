import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const hasMatchMedia = () => typeof window.matchMedia === 'function';

function subscribe(onChange: () => void) {
    if (!hasMatchMedia()) return () => {};
    const query = window.matchMedia(QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => hasMatchMedia() && window.matchMedia(QUERY).matches,
        () => false,
    );
}
