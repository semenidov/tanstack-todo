import { describe, expect, it } from 'vitest';
import { Action, can, Role } from './permissions';

describe('board permissions', () => {
    const allowed: Record<Role, readonly Action[]> = {
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
            it(`${role}: ${action}`, () => {
                expect(can(role, action)).toBe(allowed[role].includes(action));
            });
        }
    }
});
