import { Skeleton } from '#/components/ui/skeleton';

const ROW_TEXT_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-3/5'];

export function TodoListSkeleton() {
    return (
        <div
            className="min-h-screen bg-muted/30 p-4"
            aria-busy="true"
            aria-label="Loading tasks"
        >
            <div className="mx-auto max-w-md space-y-6 py-6">
                <header className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Todo List
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-20 rounded-md" />
                        <Skeleton className="size-9 rounded-md" />
                    </div>
                </header>
                <ul className="space-y-2">
                    {ROW_TEXT_WIDTHS.map((width) => (
                        <li key={width}>
                            <div className="relative flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                                <Skeleton className="size-4 shrink-0 rounded-[4px]" />
                                <div className="min-w-0 flex-1">
                                    <Skeleton className={`h-4 ${width}`} />
                                </div>
                                <div
                                    className="ml-1 size-7 shrink-0"
                                    aria-hidden="true"
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
