import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '#/components/ui/button';

const NEXT_THEME = {
    light: 'dark',
    dark: 'system',
    system: 'light',
} as const;

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
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

    const current = theme === 'light' || theme === 'dark' ? theme : 'system';
    const label = `Theme: ${current.charAt(0).toUpperCase()}${current.slice(1)}`;
    const Icon =
        current === 'light'
            ? SunIcon
            : current === 'dark'
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
