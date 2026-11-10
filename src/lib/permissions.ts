export enum Role {
    Owner = 'owner',
    Editor = 'editor',
}

export const BOARD_ACCESS_DENIED = "Board not found or you don't have access";

export enum Action {
    BoardRead = 'boardRead',
    ContentEdit = 'contentEdit',
    BoardRename = 'boardRename',
    MembersManage = 'membersManage',
    ListMoveToBoard = 'listMoveToBoard',
    BoardDelete = 'boardDelete',
    BoardLeave = 'boardLeave',
}

const PERMISSIONS: Record<Action, readonly Role[]> = {
    [Action.BoardRead]: [Role.Owner, Role.Editor],
    [Action.ContentEdit]: [Role.Owner, Role.Editor],
    [Action.BoardRename]: [Role.Owner],
    [Action.MembersManage]: [Role.Owner],
    [Action.ListMoveToBoard]: [Role.Owner],
    [Action.BoardDelete]: [Role.Owner],
    [Action.BoardLeave]: [Role.Editor],
};

export function can(role: Role, action: Action): boolean {
    return PERMISSIONS[action].includes(role);
}
