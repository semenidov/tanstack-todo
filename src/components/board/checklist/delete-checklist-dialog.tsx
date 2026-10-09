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

interface DeleteChecklistDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    itemCount: number;
    onConfirm: () => void;
}

export function DeleteChecklistDialog({
    open,
    onOpenChange,
    title,
    itemCount,
    onConfirm,
}: DeleteChecklistDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    {/* Flex row: a long title truncates, the quotes and "?" stay visible. */}
                    <AlertDialogTitle className="flex w-full min-w-0 justify-center sm:justify-start">
                        <span className="shrink-0 whitespace-pre">
                            {'Delete checklist "'}
                        </span>
                        <span className="truncate" title={title}>
                            {title}
                        </span>
                        <span className="shrink-0">&quot;?</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        The checklist and its {itemCount}{' '}
                        {itemCount === 1 ? 'item' : 'items'} will be permanently
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
