export const BOARD_ACCESS_DENIED = "Board not found or you don't have access";

export function isBoardAccessDenied(error: unknown): boolean {
    return error instanceof Error && error.message === BOARD_ACCESS_DENIED;
}
