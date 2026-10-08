import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';
import { useCallback, useRef, useState } from 'react';
import { AddCard } from '#/components/board/add-card';
import { CardItem } from '#/components/board/card-item';
import { DeleteListDialog } from '#/components/board/delete-list-dialog';
import {
    useIsListSyncing,
    useMoveList,
} from '#/components/board/list-mutations';
import { ListTitle } from '#/components/board/list-title';
import { MoveListForm } from '#/components/board/move-list-form';
import { Button } from '#/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from '#/components/ui/popover';
import { usePrefersReducedMotion } from '#/lib/use-prefers-reduced-motion';
import { boardQueryOptions } from '#/lib/boards-query';
import type { ListWithCards } from '#/lib/boards-query';
import { restoreErrorMessage } from '#/lib/quotas';
import {
    removeListFromBoard,
    renameListInBoard,
    restoreListToBoard,
} from '#/lib/boards';
import {
    deleteListServer,
    renameListServer,
    restoreListServer,
} from '#/server/boards';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { EllipsisIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

const UNDO_WINDOW_MS = 5000;

function useRenameList(boardId: string) {
    const queryClient = useQueryClient();
    const key = boardQueryOptions(boardId).queryKey;

    return useMutation({
        mutationFn: (vars: { listId: string; title: string }) =>
            renameListServer({ data: vars }),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old) =>
                old ? renameListInBoard(old, vars.listId, vars.title) : old,
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            toast.error("Couldn't rename the list. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: key });
        },
    });
}

function useDeleteList(boardId: string) {
    const queryClient = useQueryClient();
    const deleteList = useServerFn(deleteListServer);
    const restoreList = useServerFn(restoreListServer);
    const key = boardQueryOptions(boardId).queryKey;

    const removeFromCache = (listId: string) =>
        queryClient.setQueryData(key, (old) =>
            old ? removeListFromBoard(old, listId) : old,
        );
    const returnToCache = (list: ListWithCards) =>
        queryClient.setQueryData(key, (old) =>
            old ? restoreListToBoard(old, list) : old,
        );
    const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

    // Soft delete on the server right away, so a refetch at any moment matches the cache.
    const remove = async (list: ListWithCards) => {
        await queryClient.cancelQueries({ queryKey: key });
        removeFromCache(list.id);
        try {
            await deleteList({ data: { listId: list.id } });
            return true;
        } catch {
            returnToCache(list);
            toast.error("Couldn't delete the list. Please try again.");
            return false;
        } finally {
            invalidate();
        }
    };

    const undo = async (list: ListWithCards) => {
        await queryClient.cancelQueries({ queryKey: key });
        returnToCache(list);
        try {
            await restoreList({ data: { listId: list.id } });
        } catch (error) {
            removeFromCache(list.id);
            toast.error(
                restoreErrorMessage(
                    error,
                    "Couldn't restore the list. Please try again.",
                ),
            );
        } finally {
            invalidate();
        }
    };

    const deleteConfirmed = (list: ListWithCards) => {
        void remove(list);
    };

    const deleteEmptyWithUndo = async (list: ListWithCards) => {
        if (!(await remove(list))) return;
        toast.warning(`Deleted "${list.title}"`, {
            icon: <Trash2Icon className="size-4" />,
            action: { label: 'Undo', onClick: () => void undo(list) },
            duration: UNDO_WINDOW_MS,
        });
    };

    return { deleteConfirmed, deleteEmptyWithUndo };
}

interface ListColumnProps {
    board: { id: string; title: string };
    list: ListWithCards;
    allLists: Array<ListWithCards>;
}

export function ListColumn({ board, list, allLists }: ListColumnProps) {
    const boardId = board.id;
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isMoveOpen, setIsMoveOpen] = useState(false);
    // The popover opens once the menu has closed: opening it from onSelect would
    // let the menu's focus return to its trigger and dismiss the popover at once.
    const openMoveOnMenuCloseRef = useRef(false);
    const titleButtonRef = useRef<HTMLButtonElement | null>(null);
    const renameList = useRenameList(boardId);
    const { deleteConfirmed, deleteEmptyWithUndo } = useDeleteList(boardId);
    const { moveListToBoard } = useMoveList(boardId);
    const isSyncing = useIsListSyncing(boardId, list.id);
    const reducedMotion = usePrefersReducedMotion();
    // One sortable per column: it is also the drop target of dragged cards (the
    // title and AddCard put a card first), so there is no separate droppable.
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: list.id,
        data: { type: 'list' },
        // Neighbors jump instead of sliding apart.
        transition: reducedMotion ? null : undefined,
    });

    const setTitleButtonRef = useCallback(
        (el: HTMLButtonElement | null) => {
            titleButtonRef.current = el;
            setActivatorNodeRef(el);
        },
        [setActivatorNodeRef],
    );

    function handleDeleteSelected() {
        if (list.cards.length === 0) {
            void deleteEmptyWithUndo(list);
        } else {
            setIsDeleteDialogOpen(true);
        }
    }

    return (
        <Popover open={isMoveOpen} onOpenChange={setIsMoveOpen}>
            <div
                ref={setNodeRef}
                style={{
                    transform: CSS.Translate.toString(transform),
                    transition,
                }}
                className={cn(
                    'flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-lg border bg-card sm:w-72 sm:snap-start',
                    // The placeholder where the dragged list will land.
                    isDragging &&
                        'border-dashed bg-muted shadow-none *:invisible',
                )}
            >
                {/* The header is the drag handle for a pointer (the title button gets
                    the keyboard: Space picks the list up, Enter renames). The keydown
                    of the button bubbles here, and the button is the activator node. */}
                <PopoverAnchor asChild>
                    <div
                        // While renaming there is no title button (the activator):
                        // Space in the input would pick the list up.
                        {...(isEditingTitle ? undefined : listeners)}
                        className="flex items-center justify-between gap-2 border-b px-3 py-2 select-none [-webkit-touch-callout:none]"
                    >
                        <ListTitle
                            title={list.title}
                            count={list.cards.length}
                            isEditing={isEditingTitle}
                            buttonRef={setTitleButtonRef}
                            aria-describedby={attributes['aria-describedby']}
                            onStartEditing={() => setIsEditingTitle(true)}
                            onCancelEditing={() => setIsEditingTitle(false)}
                            onSave={(title) =>
                                renameList.mutate({ listId: list.id, title })
                            }
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="List actions"
                                    className="shrink-0"
                                >
                                    <EllipsisIcon />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                onCloseAutoFocus={(e) => {
                                    if (!openMoveOnMenuCloseRef.current) return;
                                    openMoveOnMenuCloseRef.current = false;
                                    e.preventDefault();
                                    setIsMoveOpen(true);
                                }}
                            >
                                <DropdownMenuItem
                                    onSelect={() => setIsEditingTitle(true)}
                                >
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => {
                                        openMoveOnMenuCloseRef.current = true;
                                    }}
                                >
                                    Move…
                                </DropdownMenuItem>
                                {/* Deleting a list with a move of it or its cards in
                                    flight would race the move. */}
                                <DropdownMenuItem
                                    variant="destructive"
                                    disabled={isSyncing}
                                    onSelect={handleDeleteSelected}
                                >
                                    Delete…
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </PopoverAnchor>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <AddCard boardId={boardId} listId={list.id} />
                    <SortableContext
                        id={list.id}
                        items={list.cards.map((card) => card.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <ul className="space-y-2 pt-2">
                            {list.cards.map((card) => (
                                <CardItem
                                    key={card.id}
                                    boardId={boardId}
                                    card={card}
                                    lists={allLists}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </div>
                <DeleteListDialog
                    open={isDeleteDialogOpen}
                    onOpenChange={setIsDeleteDialogOpen}
                    listTitle={list.title}
                    cardCount={list.cards.length}
                    onConfirm={() => deleteConfirmed(list)}
                />
            </div>
            <PopoverContent
                align="start"
                aria-label="Move list"
                onCloseAutoFocus={(e) => {
                    // No trigger to return to: focus the list title, wherever it is now.
                    e.preventDefault();
                    titleButtonRef.current?.focus();
                }}
            >
                <MoveListForm
                    list={list}
                    board={board}
                    lists={allLists}
                    isSyncing={isSyncing}
                    onMove={(toBoard, index) => {
                        setIsMoveOpen(false);
                        moveListToBoard(list.id, toBoard, index);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
