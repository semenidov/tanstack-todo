import { cn } from 'cn';
import type { ReactNode } from 'react';

const variants = {
    page: 'max-w-page space-y-6 py-6',
    auth: 'max-w-auth space-y-6 py-16',
    message: 'max-w-page flex flex-col items-center gap-4 py-16 text-center',
} as const;

interface PageShellProps {
    variant?: keyof typeof variants;
    children: ReactNode;
}

export function PageShell({ variant = 'page', children }: PageShellProps) {
    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className={cn('mx-auto', variants[variant])}>{children}</div>
        </div>
    );
}
