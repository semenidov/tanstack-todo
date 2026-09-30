import { AddList } from '#/components/board/add-list';
import { ListColumn } from '#/components/board/list-column';
import { ThemeToggle } from '#/components/theme-toggle';
import { Button } from '#/components/ui/button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '#/components/ui/empty';
import { authClient } from '#/lib/auth-client';
import type { BoardData } from '#/lib/boards-query';
import { useDragScroll } from '#/lib/use-drag-scroll';
import { useRouter } from '@tanstack/react-router';
import { LayoutDashboardIcon, LogOutIcon } from 'lucide-react';

export function BoardView({ board, lists }: BoardData) {
    const router = useRouter();
    const dragScrollRef = useDragScroll();

    async function handleSignOut() {
        await authClient.signOut();
        await router.invalidate();
        await router.navigate({ to: '/login' });
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/30">
            <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                    {board.title}
                </h1>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSignOut}
                        aria-label="Sign out"
                    >
                        <LogOutIcon />
                    </Button>
                </div>
            </header>

            {lists.length === 0 ? (
                <div className="p-4">
                    <Empty className="border bg-card">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <LayoutDashboardIcon />
                            </EmptyMedia>
                            <EmptyTitle>Board is empty</EmptyTitle>
                            <EmptyDescription>
                                Add your first list to get started.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <AddList
                                boardId={board.id}
                                className="w-full max-w-72 sm:w-full"
                            />
                        </EmptyContent>
                    </Empty>
                </div>
            ) : (
                <div
                    ref={dragScrollRef}
                    className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-[7.5vw] py-4 sm:p-4 md:cursor-grab md:*:cursor-auto"
                >
                    {lists.map((list) => (
                        <ListColumn
                            key={list.id}
                            boardId={board.id}
                            list={list}
                            allLists={lists}
                        />
                    ))}
                    <AddList boardId={board.id} />
                </div>
            )}
        </div>
    );
}
