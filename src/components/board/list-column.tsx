import { useState } from 'react';
import { AddCard } from '#/components/board/add-card';
import { CardItem } from '#/components/board/card-item';
import { DeleteListDialog } from '#/components/board/delete-list-dialog';
import { ListTitle } from '#/components/board/list-title';
import { Button } from '#/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import { boardQueryOptions } from '#/lib/boards-query';
import type { ListWithCards } from '#/lib/boards-query';
import { isTempId, removeListFromBoard, renameListInBoard } from '#/lib/boards';
import { deleteListServer, renameListServer } from '#/server/boards';
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
    const key = boardQueryOptions(boardId).queryKey;

    const commitDelete = (listId: string) => deleteList({ data: { listId } });

    const deleteConfirmed = (listId: string) => {
        const previous = queryClient.getQueryData(key);
        queryClient.setQueryData(key, (old) =>
            old ? removeListFromBoard(old, listId) : old,
        );
        commitDelete(listId)
            .then(() => queryClient.invalidateQueries({ queryKey: key }))
            .catch(() => {
                queryClient.setQueryData(key, previous);
                toast.error("Couldn't delete the list. Please try again.");
            });
    };

    const deleteEmptyWithUndo = (list: ListWithCards) => {
        const previous = queryClient.getQueryData(key);
        queryClient.setQueryData(key, (old) =>
            old ? removeListFromBoard(old, list.id) : old,
        );

        let settled = false;
        const restore = () => queryClient.setQueryData(key, previous);

        const commit = async () => {
            if (settled) return;
            settled = true;
            try {
                await commitDelete(list.id);
                queryClient.invalidateQueries({ queryKey: key });
            } catch {
                restore();
                toast.error("Couldn't delete the list. Please try again.");
            }
        };

        const undo = () => {
            if (settled) return;
            settled = true;
            restore();
        };

        toast.warning(`Deleted "${list.title}"`, {
            icon: <Trash2Icon className="size-4" />,
            action: { label: 'Undo', onClick: undo },
            duration: UNDO_WINDOW_MS,
            onAutoClose: commit,
            onDismiss: commit,
        });
    };

    return { deleteConfirmed, deleteEmptyWithUndo };
}

interface ListColumnProps {
    boardId: string;
    list: ListWithCards;
    allLists: Array<ListWithCards>;
}

export function ListColumn({ boardId, list, allLists }: ListColumnProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const renameList = useRenameList(boardId);
    const { deleteConfirmed, deleteEmptyWithUndo } = useDeleteList(boardId);
    // Not saved yet: its id is temporary, so rename/delete would hit a missing list.
    const isSaving = isTempId(list.id);

    function handleDeleteSelected() {
        if (list.cards.length === 0) {
            deleteEmptyWithUndo(list);
        } else {
            setIsDeleteDialogOpen(true);
        }
    }

    return (
        <div
            data-list-id={list.id}
            className="flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-lg border bg-card sm:w-72 sm:snap-start"
        >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <ListTitle
                    title={list.title}
                    count={list.cards.length}
                    isEditing={isEditingTitle}
                    disabled={isSaving}
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
                            disabled={isSaving}
                            className="shrink-0"
                        >
                            <EllipsisIcon />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onSelect={() => setIsEditingTitle(true)}
                        >
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={handleDeleteSelected}
                        >
                            Delete…
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <AddCard boardId={boardId} listId={list.id} />
                <ul className="space-y-2 pt-2">
                    {list.cards.map((card) => (
                        <CardItem
                            key={card.id}
                            boardId={boardId}
                            card={card}
                            otherLists={allLists.filter(
                                (l) => l.id !== list.id,
                            )}
                        />
                    ))}
                </ul>
            </div>
            <DeleteListDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                listTitle={list.title}
                cardCount={list.cards.length}
                onConfirm={() => deleteConfirmed(list.id)}
            />
        </div>
    );
}
