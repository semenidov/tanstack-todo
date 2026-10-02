import { useState } from 'react';
import {
    useDeleteCard,
    useMoveCard,
    useUpdateCard,
} from '#/components/board/card-mutations';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '#/components/ui/dialog';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select';
import { Textarea } from '#/components/ui/textarea';
import type { Card, ListWithCards } from '#/lib/boards-query';
import { Trash2Icon } from 'lucide-react';

interface CardDialogProps {
    boardId: string;
    card: Card;
    list: ListWithCards;
    lists: Array<ListWithCards>;
    onClose: () => Promise<void> | void;
}

export function CardDialog({
    boardId,
    card,
    list,
    lists,
    onClose,
}: CardDialogProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [description, setDescription] = useState(card.description ?? '');
    const updateCard = useUpdateCard(boardId);
    const { moveCard } = useMoveCard(boardId);
    const { deleteWithUndo } = useDeleteCard(boardId);

    function commitTitle(raw: string) {
        const trimmed = raw.trim();
        if (trimmed && trimmed !== card.title) {
            updateCard.mutate({ cardId: card.id, title: trimmed });
        }
        setIsEditingTitle(false);
    }

    function saveDescription() {
        const trimmed = description.trim();
        if (trimmed !== (card.description ?? '')) {
            updateCard.mutate({
                cardId: card.id,
                description: trimmed === '' ? null : trimmed,
            });
        }
    }

    function cancelDescription() {
        setDescription(card.description ?? '');
    }

    async function handleDelete() {
        // Leave the card route first: removing the card from the cache while
        // the route is still mounted triggers its "Card not found" fallback.
        await onClose();
        deleteWithUndo(card);
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    {isEditingTitle ? (
                        <>
                            {/* Keeps the dialog named for screen readers while the title is an input. */}
                            <DialogTitle className="sr-only">
                                {card.title}
                            </DialogTitle>
                            {/* Mounted anew on every edit, so defaultValue always starts from the current title. */}
                            <Input
                                autoFocus
                                defaultValue={card.title}
                                aria-label="Card title"
                                className="h-9 border-none bg-transparent px-0 py-0 text-lg leading-none font-semibold shadow-none"
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={(e) =>
                                    commitTitle(e.currentTarget.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitTitle(e.currentTarget.value);
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setIsEditingTitle(false);
                                    }
                                }}
                            />
                        </>
                    ) : (
                        <DialogTitle asChild>
                            <button
                                type="button"
                                onClick={() => setIsEditingTitle(true)}
                                className="flex min-h-9 min-w-0 items-center text-left [overflow-wrap:anywhere]"
                            >
                                {card.title}
                            </button>
                        </DialogTitle>
                    )}
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <label
                            htmlFor="card-list"
                            className="mb-2 block text-sm font-medium"
                        >
                            List
                        </label>
                        <Select
                            value={list.id}
                            // To the top of the chosen list; exact position - Move… on the card.
                            onValueChange={(toListId) =>
                                moveCard(card.id, toListId, 0)
                            }
                        >
                            <SelectTrigger id="card-list" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {lists.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label
                            htmlFor="card-description"
                            className="mb-2 block text-sm font-medium"
                        >
                            Description
                        </label>
                        <Textarea
                            id="card-description"
                            value={description}
                            placeholder="Add a description…"
                            rows={5}
                            className="h-40 resize-none overflow-y-auto field-sizing-fixed"
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        {description.trim() !== (card.description ?? '') && (
                            <div className="mt-3 flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelDescription}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={saveDescription}>
                                    Save
                                </Button>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        className="w-full"
                    >
                        <Trash2Icon />
                        Delete card
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
