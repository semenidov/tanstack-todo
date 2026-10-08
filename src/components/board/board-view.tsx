import { AddList } from '#/components/board/add-list';
import { BoardDnd } from '#/components/board/board-dnd';
import { ListColumn } from '#/components/board/list-column';
import { EditableTitle } from '#/components/editable-title';
import { useRenameBoard } from '#/components/boards/board-mutations';
import { GuestBanner } from '#/components/guest-banner';
import { SignOutButton } from '#/components/sign-out-button';
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
import type { BoardData } from '#/lib/boards-query';
import { useDragScroll } from '#/lib/use-drag-scroll';
import { Link, useRouter } from '@tanstack/react-router';
import { cn } from 'cn';
import { ArrowLeftIcon, LayoutDashboardIcon } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export function BoardView({ board, lists }: BoardData) {
    const router = useRouter();
    const renameBoard = useRenameBoard();
    const [isEditing, setIsEditing] = useState(false);
    const dragScrollRef = useDragScroll();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const prevListCountRef = useRef(lists.length);

    // One ref for both: drag-pan listeners and the container handle for scrolling.
    const setContainerRef = useCallback(
        (el: HTMLDivElement | null) => {
            containerRef.current = el;
            const cleanupDragScroll = dragScrollRef(el);
            return () => {
                containerRef.current = null;
                cleanupDragScroll?.();
            };
        },
        [dragScrollRef],
    );

    // Scroll to a newly added list after it is rendered. A new list gets a key after
    // all others, so it is always the last column before AddList.
    useLayoutEffect(() => {
        const prevCount = prevListCountRef.current;
        prevListCountRef.current = lists.length;
        if (lists.length <= prevCount) return;
        containerRef.current?.children[lists.length - 1]?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
        });
    }, [lists.length]);

    return (
        <div className="flex min-h-screen flex-col bg-muted/30">
            <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                    >
                        <Link to="/boards" aria-label="Back to boards">
                            <ArrowLeftIcon />
                            <span className="hidden sm:inline">Boards</span>
                        </Link>
                    </Button>
                    <h1 className="min-w-0">
                        <EditableTitle
                            title={board.title}
                            isEditing={isEditing}
                            aria-label="Board title"
                            className="block h-9 max-w-full truncate rounded-sm px-2 text-xl leading-9 font-semibold tracking-tight"
                            inputClassName="h-9 px-2 text-xl leading-9 font-semibold tracking-tight md:text-xl"
                            onStartEditing={() => setIsEditing(true)}
                            onCancelEditing={() => setIsEditing(false)}
                            onSave={(title) =>
                                renameBoard.mutate(
                                    { boardId: board.id, title },
                                    // The tab title comes from loader data, so re-run the loader.
                                    { onSettled: () => router.invalidate() },
                                )
                            }
                        />
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <SignOutButton />
                </div>
            </header>
            <GuestBanner />

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
                <BoardDnd board={board} lists={lists}>
                    {({ lists: shownLists, isDragging }) => (
                        <div
                            ref={setContainerRef}
                            className={cn(
                                'flex flex-1 items-start gap-4 overflow-x-auto px-[7.5vw] py-4 sm:p-4 md:cursor-grab md:*:cursor-auto',
                                // No snapping while a card is dragged: it would fight auto-scroll.
                                isDragging
                                    ? 'snap-none'
                                    : 'snap-x snap-mandatory',
                            )}
                        >
                            {shownLists.map((list) => (
                                <ListColumn
                                    key={list.id}
                                    board={board}
                                    list={list}
                                    allLists={shownLists}
                                />
                            ))}
                            <AddList boardId={board.id} />
                        </div>
                    )}
                </BoardDnd>
            )}
        </div>
    );
}
