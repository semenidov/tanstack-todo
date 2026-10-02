import { useEffect, useState } from 'react';

/**
 * True once `flag` has stayed true for `delayMs`; false again as soon as `flag`
 * is. Keeps short-lived states (a fast request) from flashing an indicator.
 */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
    const [elapsed, setElapsed] = useState(false);

    useEffect(() => {
        if (!flag) return;
        const timer = setTimeout(() => setElapsed(true), delayMs);
        return () => {
            clearTimeout(timer);
            setElapsed(false);
        };
    }, [flag, delayMs]);

    return flag && elapsed;
}
