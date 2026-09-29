import { BoardTile } from '#/components/boards/board-tile';
import {
    useDeleteBoard,
    useRenameBoard,
} from '#/components/boards/board-mutations';
import { CreateBoardTile } from '#/components/boards/create-board-tile';
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
import type { BoardSummary } from '#/lib/boards-query';
import { useRouter } from '@tanstack/react-router';
import { LayoutDashboardIcon, LogOutIcon } from 'lucide-react';

interface BoardsViewProps {
    boards: BoardSummary[];
}

export function BoardsView({ boards }: BoardsViewProps) {
    const router = useRouter();
    const renameBoard = useRenameBoard();
    const deleteBoard = useDeleteBoard();

    async function handleSignOut() {
        await authClient.signOut();
        await router.invalidate();
        await router.navigate({ to: '/login' });
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/30">
            <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                    Boards
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

            {boards.length === 0 ? (
                <div className="p-4">
                    <Empty className="border bg-card">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <LayoutDashboardIcon />
                            </EmptyMedia>
                            <EmptyTitle>No boards yet</EmptyTitle>
                            <EmptyDescription>
                                Create your first board to start.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <CreateBoardTile className="w-full max-w-72" />
                        </EmptyContent>
                    </Empty>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                    {boards.map((board) => (
                        <BoardTile
                            key={board.id}
                            board={board}
                            onRename={(title) =>
                                renameBoard.mutate({
                                    boardId: board.id,
                                    title,
                                })
                            }
                            onDelete={() => deleteBoard.mutate(board.id)}
                        />
                    ))}
                    <CreateBoardTile />
                </div>
            )}
        </div>
    );
}
