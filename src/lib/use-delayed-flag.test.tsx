import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedFlag } from '#/lib/use-delayed-flag';

describe('useDelayedFlag', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('turns on only after the flag stays on for the delay', () => {
        const { result } = renderHook(() => useDelayedFlag(true, 300));

        expect(result.current).toBe(false);
        act(() => vi.advanceTimersByTime(299));
        expect(result.current).toBe(false);
        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe(true);
    });

    it('never turns on when the flag goes off before the delay', () => {
        const { result, rerender } = renderHook(
            ({ flag }) => useDelayedFlag(flag, 300),
            { initialProps: { flag: true } },
        );

        act(() => vi.advanceTimersByTime(200));
        rerender({ flag: false });
        act(() => vi.advanceTimersByTime(500));

        expect(result.current).toBe(false);
    });

    it('turns off right away with the flag and restarts the delay', () => {
        const { result, rerender } = renderHook(
            ({ flag }) => useDelayedFlag(flag, 300),
            { initialProps: { flag: true } },
        );
        act(() => vi.advanceTimersByTime(300));
        expect(result.current).toBe(true);

        rerender({ flag: false });
        expect(result.current).toBe(false);

        rerender({ flag: true });
        expect(result.current).toBe(false);
        act(() => vi.advanceTimersByTime(300));
        expect(result.current).toBe(true);
    });
});
