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
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
                {icon}
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight">
                        {title}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                {action}
            </div>
        </div>
    );
}
