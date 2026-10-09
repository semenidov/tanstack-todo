import { useSyncExternalStore } from 'react';

/** Tailwind `md`: from this width the layout is desktop. */
export const DESKTOP_QUERY = '(min-width: 768px)';

// jsdom and old browsers have no matchMedia: the query never matches there.
const hasMatchMedia = () => typeof window.matchMedia === 'function';

/** Whether the CSS media query matches; false on the server and before hydration. */
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

/** Desktop by width: popovers there, bottom sheets on mobile. */
export function useIsDesktop(): boolean {
    return useMediaQuery(DESKTOP_QUERY);
}
