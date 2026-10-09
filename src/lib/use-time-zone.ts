import { useRouteContext } from '@tanstack/react-router';
import { useMemo, useSyncExternalStore } from 'react';
import { deviceTimeZone } from '#/lib/due-date';

// Time zone and clock for relative dates (#120). The server renders with the
// zone from the cookie and the request time (root route context); hydration
// uses the same values, then the client re-renders with the device's zone and
// clock. No hydration mismatch, and the first visit without the cookie (UTC)
// gets corrected right after hydration.

const subscribeNever = () => () => {};

/** The time zone to render dates in. */
export function useTimeZone(): string {
    const cookieTimeZone = useRouteContext({
        from: '__root__',
        select: (context) => context.timeZone,
    });
    return useSyncExternalStore(
        subscribeNever,
        deviceTimeZone,
        () => cookieTimeZone,
    );
}

// A shared clock with minute precision: a due date turns overdue at most a
// minute late, and the snapshot stays stable between renders.
const MINUTE_MS = 60_000;
const TICK_MS = 15_000;
let nowMs = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function getNowMs() {
    const t = Date.now();
    if (t - nowMs >= MINUTE_MS) nowMs = t;
    return nowMs;
}

function subscribeClock(onChange: () => void) {
    listeners.add(onChange);
    timer ??= setInterval(() => {
        for (const listener of listeners) listener();
    }, TICK_MS);
    return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
            clearInterval(timer);
            timer = undefined;
        }
    };
}

/** The current time, updated about every minute. */
export function useNow(): Date {
    const renderedAt = useRouteContext({
        from: '__root__',
        select: (context) => context.now.getTime(),
    });
    const ms = useSyncExternalStore(subscribeClock, getNowMs, () => renderedAt);
    return useMemo(() => new Date(ms), [ms]);
}
