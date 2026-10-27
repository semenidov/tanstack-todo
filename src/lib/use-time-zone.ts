import { useRouteContext } from '@tanstack/react-router';
import { useMemo, useSyncExternalStore } from 'react';
import { deviceTimeZone } from '#/lib/due-date';

const subscribeNever = () => () => {};

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

export function useNow(): Date {
    const renderedAt = useRouteContext({
        from: '__root__',
        select: (context) => context.now.getTime(),
    });
    const ms = useSyncExternalStore(subscribeClock, getNowMs, () => renderedAt);
    return useMemo(() => new Date(ms), [ms]);
}
