import { randomBytes } from 'node:crypto';
import { BOARD_ACCESS_DENIED, Action  } from '#/lib/permissions';
import { getSharing, shareBoard, removeMember, leaveBoard  } from './members-repo';
import { requireUser } from '#/lib/auth-server';
import { authorizeBoard, requireChanged } from './authorize';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

export const leaveBoardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ boardId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id: userId } = await requireUser();
        requireChanged(
            await leaveBoard(
                await authorizeBoard(userId, data.boardId, Action.BoardLeave),
            ),
        );
    });

export const getSharingServer = createServerFn({ method: 'GET' })
    .validator(z.object({ boardId: z.uuid() }))
    .handler(async ({ data }) => {
        const { id } = await requireUser();
        const result = await getSharing(
            await authorizeBoard(id, data.boardId, Action.MembersManage),
        );
        if (!result) throw new Error(BOARD_ACCESS_DENIED);
        return result;
    });

export const shareBoardServer = createServerFn({ method: 'POST' })
    .validator(
        z.object({ boardId: z.uuid(), reset: z.boolean().default(false) }),
    )
    .handler(async ({ data }) => {
        const { id } = await requireUser();
        const rows = requireChanged(
            await shareBoard(
                await authorizeBoard(id, data.boardId, Action.MembersManage),
                randomBytes(32).toString('hex'),
                data.reset,
            ),
        );
        return rows[0];
    });

export const removeMemberServer = createServerFn({ method: 'POST' })
    .validator(z.object({ boardId: z.uuid(), memberId: z.string().min(1) }))
    .handler(async ({ data }) => {
        const { id } = await requireUser();
        requireChanged(
            await removeMember(
                await authorizeBoard(id, data.boardId, Action.MembersManage),
                data.memberId,
            ),
        );
    });
