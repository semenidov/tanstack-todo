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

interface LeaveBoardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    boardTitle: string;
    onConfirm: () => void;
}

export function LeaveBoardDialog({
    open,
    onOpenChange,
    boardTitle,
    onConfirm,
}: LeaveBoardDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    {/* Flex row: a long title truncates, the quotes and "?" stay visible. */}
                    <AlertDialogTitle className="flex w-full min-w-0 justify-center sm:justify-start">
                        <span className="shrink-0 whitespace-pre">
                            {'Leave board "'}
                        </span>
                        <span className="truncate" title={boardTitle}>
                            {boardTitle}
                        </span>
                        <span className="shrink-0">&quot;?</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        You will lose access to this board.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        Leave
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
