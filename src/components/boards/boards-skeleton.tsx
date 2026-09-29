import { Skeleton } from '#/components/ui/skeleton';

const TILE_COUNT = 3;

export function BoardsSkeleton() {
    return (
        <div
            className="flex min-h-screen flex-col bg-muted/30"
            aria-busy="true"
            aria-label="Loading boards"
        >
            <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3">
                <Skeleton className="h-7 w-24" />
                <div className="flex items-center gap-2">
                    <Skeleton className="size-9 rounded-md" />
                    <Skeleton className="size-9 rounded-md" />
                </div>
            </header>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: TILE_COUNT }, (_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
            </div>
        </div>
    );
}
