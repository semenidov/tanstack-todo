import { useEffect, useState } from 'react';

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
