import { createFileRoute, redirect } from '@tanstack/react-router';
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from '@tanstack/react-query';
import { Button } from '#/components/ui/button';
import { MessageScreen } from '#/components/message-screen';
import { RouteError } from '#/components/route-error';
import { inviteQueryOptions } from '#/lib/members-query';
import { pageMeta } from '#/lib/seo';
import { joinBoardServer } from '#/server/members';
import { LinkIcon } from 'lucide-react';

const INVALID = 'Invite link is invalid';
export const Route = createFileRoute('/invite/$token')({
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    loader: async ({ context, params }) => {
        const invite = await context.queryClient.fetchQuery(
            inviteQueryOptions(params.token),
        );
        if (invite.joined)
            throw redirect({
                to: '/b/$boardId',
                params: { boardId: invite.boardId },
            });
    },
    headers: () => ({
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store',
    }),
    head: () => ({
        meta: [
            ...pageMeta('Join board'),
            { name: 'referrer', content: 'no-referrer' },
        ],
    }),
    component: InvitePage,
    errorComponent: (props) =>
        props.error instanceof Error && props.error.message === INVALID ? (
            <InvalidInvite />
        ) : (
            <RouteError {...props} />
        ),
});

function InvalidInvite() {
    return (
        <MessageScreen
            icon={<LinkIcon />}
            title={INVALID}
            description="Ask the board owner for a new invite link."
        />
    );
}

function InvitePage() {
    const { token } = Route.useParams();
    const { data } = useSuspenseQuery(inviteQueryOptions(token));
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();
    const join = useMutation({
        mutationFn: () => joinBoardServer({ data: { token } }),
        onSuccess: async ({ boardId }) => {
            await queryClient.invalidateQueries({ queryKey: ['boards'] });
            await navigate({ to: '/b/$boardId', params: { boardId } });
        },
    });
    if (join.error?.message === INVALID) return <InvalidInvite />;
    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="mx-auto max-w-md space-y-4 py-16 text-center">
                <p>You're invited to</p>
                <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">
                    {data.title}
                </h1>
                <p className="[overflow-wrap:anywhere]">by {data.ownerName}</p>
                <Button disabled={join.isPending} onClick={() => join.mutate()}>
                    {join.isPending ? 'Joining...' : 'Join board'}
                </Button>
                {join.error && (
                    <p role="alert">
                        Could not join the board. Please try again.
                    </p>
                )}
            </div>
        </div>
    );
}
