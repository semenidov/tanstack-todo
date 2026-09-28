import { Skeleton } from '#/components/ui/skeleton';

const COLUMN_COUNT = 3;

export function BoardSkeleton() {
    return (
        <div
            className="flex min-h-screen flex-col bg-muted/30"
            aria-busy="true"
            aria-label="Loading board"
        >
            <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3">
                <Skeleton className="h-7 w-40" />
                <div className="flex items-center gap-2">
                    <Skeleton className="size-9 rounded-md" />
                    <Skeleton className="size-9 rounded-md" />
                </div>
            </header>
            <div className="flex flex-1 gap-4 overflow-x-hidden p-4">
                {Array.from({ length: COLUMN_COUNT }, (_, i) => (
                    <div
                        key={i}
                        className="w-[85vw] shrink-0 rounded-lg border bg-card p-3 sm:w-72"
                    >
                        <Skeleton className="mb-3 h-5 w-24" />
                        <div className="space-y-2">
                            <Skeleton className="h-9 w-full rounded-md" />
                            <Skeleton className="h-9 w-full rounded-md" />
                            <Skeleton className="h-9 w-3/4 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
