import { requireUser } from '#/lib/auth-server';
import { Action } from '#/lib/permissions';
import { authorizeBoard, requireAffected } from '#/server/authorize';
import * as repo from '#/server/members-repo';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

export const leaveBoardServer = createServerFn({ method: 'POST' })
    .validator(z.object({ boardId: z.uuid() }))
    .handler(async ({ data }) => {
        const access = await authorizeBoard(
            await requireUser(),
            data.boardId,
            Action.BoardLeave,
        );
        requireAffected(await repo.leaveBoard(access));
    });
