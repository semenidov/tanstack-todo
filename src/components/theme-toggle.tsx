import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '#/components/ui/button';

export enum Theme {
    Light = 'light',
    Dark = 'dark',
    System = 'system',
}

const NEXT_THEME: Record<Theme, Theme> = {
    [Theme.Light]: Theme.Dark,
    [Theme.Dark]: Theme.System,
    [Theme.System]: Theme.Light,
};

const THEME_LABEL: Record<Theme, string> = {
    [Theme.Light]: 'Light',
    [Theme.Dark]: 'Dark',
    [Theme.System]: 'System',
};

const subscribe = () => () => {};

function useHydrated() {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
}

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const hydrated = useHydrated();

    if (!hydrated) {
        return (
            <Button
                variant="ghost"
                size="icon"
                aria-label="Theme"
                title="Theme"
            >
                <MonitorIcon />
            </Button>
        );
    }

    const current =
        theme === Theme.Light || theme === Theme.Dark ? theme : Theme.System;
    const label = `Theme: ${THEME_LABEL[current]}`;
    const Icon =
        current === Theme.Light
            ? SunIcon
            : current === Theme.Dark
              ? MoonIcon
              : MonitorIcon;

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(NEXT_THEME[current])}
            aria-label={label}
            title={label}
        >
            <Icon />
        </Button>
    );
}
