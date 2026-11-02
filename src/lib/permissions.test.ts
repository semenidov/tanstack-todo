import { describe, expect, it } from 'vitest';
import { Action, can, Role } from './permissions';

describe('permissions', () => {
    it('explicitly allows every action for each role', () => {
        const expected: Record<Role, Action[]> = {
            [Role.Owner]: [
                Action.BoardRead,
                Action.ContentEdit,
                Action.BoardRename,
                Action.MembersManage,
                Action.ListMoveToBoard,
                Action.BoardDelete,
            ],
            [Role.Editor]: [
                Action.BoardRead,
                Action.ContentEdit,
                Action.BoardLeave,
            ],
        };
        for (const role of Object.values(Role)) {
            for (const action of Object.values(Action)) {
                expect(can(role, action), `${role}: ${action}`).toBe(
                    expected[role].includes(action),
                );
            }
        }
    });
});
