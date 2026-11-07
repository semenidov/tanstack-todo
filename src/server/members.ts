import { requireUser } from '#/lib/auth-server';
import { Action } from '#/lib/permissions';
import { authorizeBoard, requireChanged } from './authorize';
import { leaveBoard } from './members-repo';
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
