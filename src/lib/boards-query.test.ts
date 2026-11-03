import { expect, it, vi } from 'vitest';
import { BOARD_ACCESS_DENIED } from '#/lib/permissions';
import { boardQueryOptions } from './boards-query';

vi.mock('#/server/boards', () => ({
    getBoardServer: vi.fn(),
    listBoardsServer: vi.fn(),
}));
it('shows lost access immediately while retrying transient board errors', () => {
    const retry = boardQueryOptions('board').retry;
    if (typeof retry !== 'function')
        throw new Error('Expected board retry policy');
    expect(retry(0, new Error(BOARD_ACCESS_DENIED))).toBe(false);
    expect(retry(0, new Error('Network'))).toBe(true);
    expect(retry(3, new Error('Network'))).toBe(false);
});
