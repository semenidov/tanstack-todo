import { PageShell } from '#/components/page-shell';
import type { ReactNode } from 'react';

interface MessageScreenProps {
    icon: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
}

export function MessageScreen({
    icon,
    title,
    description,
    action,
}: MessageScreenProps) {
    return (
        <PageShell variant="message">
            {icon}
            <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight">
                    {title}
                </h1>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {action}
        </PageShell>
    );
}
