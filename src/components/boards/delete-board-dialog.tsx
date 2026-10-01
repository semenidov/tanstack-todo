import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '#/components/ui/alert-dialog';

interface DeleteBoardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    boardTitle: string;
    listCount: number;
    cardCount: number;
    onConfirm: () => void;
}

export function DeleteBoardDialog({
    open,
    onOpenChange,
    boardTitle,
    listCount,
    cardCount,
    onConfirm,
}: DeleteBoardDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    {/* Flex row: a long title truncates, the quotes and "?" stay visible. */}
                    <AlertDialogTitle className="flex w-full min-w-0 justify-center sm:justify-start">
                        <span className="shrink-0 whitespace-pre">
                            {'Delete board "'}
                        </span>
                        <span className="truncate" title={boardTitle}>
                            {boardTitle}
                        </span>
                        <span className="shrink-0">&quot;?</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        The board, its {listCount}{' '}
                        {listCount === 1 ? 'list' : 'lists'} and {cardCount}{' '}
                        {cardCount === 1 ? 'card' : 'cards'} will be permanently
                        deleted.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
