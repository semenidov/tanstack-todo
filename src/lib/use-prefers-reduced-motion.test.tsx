import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from '#/lib/use-prefers-reduced-motion';

function mockMatchMedia(initial: boolean) {
    let matches = initial;
    const listeners = new Set<() => void>();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        get matches() {
            return query === '(prefers-reduced-motion: reduce)' && matches;
        },
        addEventListener: (_type: string, listener: () => void) =>
            listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) =>
            listeners.delete(listener),
    }));
    return (next: boolean) => {
        matches = next;
        listeners.forEach((listener) => listener());
    };
}

describe('usePrefersReducedMotion', () => {
    const original = window.matchMedia;

    afterEach(() => {
        window.matchMedia = original;
    });

    it('follows the reduced motion setting', () => {
        const setReduced = mockMatchMedia(true);
        const { result } = renderHook(() => usePrefersReducedMotion());

        expect(result.current).toBe(true);
        act(() => setReduced(false));
        expect(result.current).toBe(false);
    });

    it('is false without matchMedia', () => {
        // @ts-expect-error -- some environments (jsdom) have no matchMedia
        window.matchMedia = undefined;
        const { result } = renderHook(() => usePrefersReducedMotion());

        expect(result.current).toBe(false);
    });
});
