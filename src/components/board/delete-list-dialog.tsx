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
                    {/* Flex row: a long title truncates, the quotes and "?" stay visible. */}
                    <AlertDialogTitle className="flex w-full min-w-0 justify-center sm:justify-start">
                        <span className="shrink-0 whitespace-pre">
                            {'Delete list "'}
                        </span>
                        <span className="truncate" title={listTitle}>
                            {listTitle}
                        </span>
                        <span className="shrink-0">&quot;?</span>
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
