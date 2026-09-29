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
                    <AlertDialogTitle>
                        Delete board &quot;{boardTitle}&quot;?
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
