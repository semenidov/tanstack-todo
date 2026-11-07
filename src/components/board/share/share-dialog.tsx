import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getSharingServer,
    shareBoardServer,
    removeMemberServer,
} from '#/server/members';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '#/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from '#/components/ui/alert-dialog';
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '#/components/ui/popover';
import { toast } from 'sonner';

export function ShareDialog({
    boardId,
    title,
}: {
    boardId: string;
    title: string;
}) {
    const [open, setOpen] = useState(false);
    const [confirmShare, setConfirmShare] = useState(false);
    const [removing, setRemoving] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const client = useQueryClient();
    const key = ['members', boardId];
    const sharing = useQuery({
        queryKey: key,
        queryFn: () => getSharingServer({ data: { boardId } }),
    });
    const change = useMutation({
        mutationFn: (data: { reset: boolean }) =>
            shareBoardServer({ data: { boardId, ...data } }),
        onSuccess: async () => {
            setConfirmShare(false);
            setOpen(true);
            await client.invalidateQueries({ queryKey: key });
        },
        onError: (error) => toast.error(error.message),
    });
    const remove = useMutation({
        mutationFn: (memberId: string) =>
            removeMemberServer({ data: { boardId, memberId } }),
        onSuccess: async () => {
            setRemoving(null);
            await client.invalidateQueries({ queryKey: key });
        },
        onError: (error) => toast.error(error.message),
    });
    const token = sharing.data?.token;
    const link = token ? `${window.location.origin}/invite/${token}` : '';
    return (
        <>
            <Button
                variant="outline"
                disabled={sharing.isPending}
                onClick={() => {
                    if (sharing.data && !sharing.data.token)
                        setConfirmShare(true);
                    else setOpen(true);
                }}
            >
                Share
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto">
                    <DialogTitle className="truncate" title={title}>
                        Share board &quot;{title}&quot;
                    </DialogTitle>
                    <DialogDescription>
                        Invite people to edit this board.
                    </DialogDescription>
                    {sharing.isPending ? (
                        <p>Loading…</p>
                    ) : sharing.isError ? (
                        <>
                            <p role="alert">{sharing.error.message}</p>
                            <Button onClick={() => sharing.refetch()}>
                                Retry
                            </Button>
                        </>
                    ) : !token ? (
                        <Button onClick={() => setConfirmShare(true)}>
                            Share board
                        </Button>
                    ) : (
                        <>
                            <label className="grid gap-2">
                                Invite link
                                <Input readOnly value={link} />
                            </label>
                            <div className="flex gap-2">
                                <Button
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(
                                                link,
                                            );
                                            toast.success('Link copied');
                                        } catch {
                                            toast.error('Could not copy link');
                                        }
                                    }}
                                >
                                    Copy
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={change.isPending}
                                    onClick={() =>
                                        change.mutate({ reset: true })
                                    }
                                >
                                    Reset link
                                </Button>
                            </div>
                            <h3>Members</h3>
                            {sharing.data.members.length === 0 && (
                                <p>No members yet.</p>
                            )}
                            {sharing.data.members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex min-w-0 items-center justify-between gap-2"
                                >
                                    {member.email ? (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="min-w-0 truncate"
                                                    title={member.email}
                                                >
                                                    {member.name}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="break-all">
                                                {member.email}
                                            </PopoverContent>
                                        </Popover>
                                    ) : (
                                        <span
                                            className="min-w-0 truncate"
                                            title={member.name}
                                        >
                                            {member.name}
                                        </span>
                                    )}
                                    <Button
                                        variant="outline"
                                        onClick={() => setRemoving(member)}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ))}
                        </>
                    )}
                </DialogContent>
            </Dialog>
            <AlertDialog open={confirmShare} onOpenChange={setConfirmShare}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="truncate" title={title}>
                            Share board &quot;{title}&quot;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Anyone with the invite link can join and edit this
                            board. A shared board can't be made private again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={change.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={change.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                change.mutate({ reset: false });
                            }}
                        >
                            Share
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
                open={!!removing}
                onOpenChange={(value) => {
                    if (!value) setRemoving(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle
                            className="truncate"
                            title={removing?.name}
                        >
                            Remove {removing?.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            They can rejoin with the current invite link. Reset
                            the link to prevent this.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={remove.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                if (removing) remove.mutate(removing.id);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
