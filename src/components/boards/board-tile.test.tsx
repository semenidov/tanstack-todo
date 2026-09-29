import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BoardTile } from '#/components/boards/board-tile';

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        children,
        className,
    }: {
        children: React.ReactNode;
        className?: string;
    }) => (
        <a href="/b/x" className={className}>
            {children}
        </a>
    ),
}));

const board = { id: 'b1', title: 'Roadmap', listCount: 2, cardCount: 5 };

function renderTile(onRename = vi.fn()) {
    render(<BoardTile board={board} onRename={onRename} onDelete={vi.fn()} />);
    return onRename;
}

async function startRename(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Board actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    return screen.getByLabelText('Board title');
}

describe('BoardTile', () => {
    it('renders a link with title and list count', () => {
        renderTile();

        expect(screen.getByRole('link')).toHaveTextContent('Roadmap');
        expect(screen.getByText('2 lists')).toBeInTheDocument();
    });

    it('saves the trimmed title on Enter and has no link while renaming', async () => {
        const user = userEvent.setup();
        const onRename = renderTile();

        const input = await startRename(user);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();

        await user.clear(input);
        await user.type(input, '  Plan  {Enter}');

        expect(onRename).toHaveBeenCalledWith('Plan');
        expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('cancels on Escape without saving', async () => {
        const user = userEvent.setup();
        const onRename = renderTile();

        const input = await startRename(user);
        await user.type(input, ' more{Escape}');

        expect(onRename).not.toHaveBeenCalled();
        expect(screen.getByRole('link')).toHaveTextContent('Roadmap');
    });

    it('does not save an empty title', async () => {
        const user = userEvent.setup();
        const onRename = renderTile();

        const input = await startRename(user);
        await user.clear(input);
        await user.type(input, '   {Enter}');

        expect(onRename).not.toHaveBeenCalled();
        expect(screen.getByRole('link')).toHaveTextContent('Roadmap');
    });
});
