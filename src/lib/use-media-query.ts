import { useSyncExternalStore } from 'react';

export const DESKTOP_QUERY = '(min-width: 768px)';

const hasMatchMedia = () => typeof window.matchMedia === 'function';

export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            if (!hasMatchMedia()) return () => {};
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        () => hasMatchMedia() && window.matchMedia(query).matches,
        () => false,
    );
}

export function useIsDesktop(): boolean {
    return useMediaQuery(DESKTOP_QUERY);
}
