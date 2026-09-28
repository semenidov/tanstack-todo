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

interface DeleteListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listTitle: string;
    cardCount: number;
    onConfirm: () => void;
}

export function DeleteListDialog({
    open,
    onOpenChange,
    listTitle,
    cardCount,
    onConfirm,
}: DeleteListDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete list &quot;{listTitle}&quot;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        The list and its {cardCount}{' '}
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
