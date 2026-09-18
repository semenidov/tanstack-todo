import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TodoList } from '#/components/todo-list';
import type { Todo } from '#/components/todo-list';

const { toggleSpy, deleteSpy } = vi.hoisted(() => ({
    toggleSpy: vi.fn(() => Promise.resolve()),
    deleteSpy: vi.fn(() => Promise.resolve()),
}));

vi.mock('#/server/todos', () => ({
    getTodosServer: vi.fn(() => Promise.resolve([])),
    getTodoServer: vi.fn(() => Promise.resolve(null)),
    addTodoServer: vi.fn(() => Promise.resolve()),
    updateTodoServer: vi.fn(() => Promise.resolve()),
    toggleTodoServer: toggleSpy,
    deleteTodoServer: deleteSpy,
}));

vi.mock('@tanstack/react-start', () => ({
    useServerFn: (fn: unknown) => fn,
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        params,
        children,
        ...rest
    }: {
        to: string;
        params?: { todoId?: string };
        children: ReactNode;
    }) => {
        const href = params?.todoId ? to.replace('$todoId', params.todoId) : to;
        return (
            <a href={href} {...rest}>
                {children}
            </a>
        );
    },
}));

vi.mock('sonner', () => ({
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

type ToastOpts = {
    action?: { label: string; onClick: () => void };
    onAutoClose?: () => void | Promise<void>;
};

function lastUndoToastOptions(): ToastOpts {
    return vi.mocked(toast.warning).mock.calls[0][1] as unknown as ToastOpts;
}

const todoList: Array<Todo> = [
    {
        id: '1',
        name: 'active task',
        isComplete: false,
        userId: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: '2',
        name: 'done task',
        isComplete: true,
        userId: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

function renderList(list: Array<Todo> = todoList) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <TodoList todoList={list} />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('TodoList', () => {
    it('shows the empty state with a link to add a task when there are no todos', () => {
        renderList([]);
        expect(screen.getByText('List is empty')).toBeInTheDocument();
        expect(screen.getByText('Add task').closest('a')?.getAttribute('href')).toBe(
            '/new',
        );
        expect(screen.queryByRole('listitem')).toBeNull();
    });

    it('renders every todo name', () => {
        renderList();
        expect(screen.getByText('active task')).toBeInTheDocument();
        expect(screen.getByText('done task')).toBeInTheDocument();
    });

    it('strikes through completed todos only', () => {
        renderList();
        expect(screen.getByText('done task').className).toContain(
            'line-through',
        );
        expect(screen.getByText('active task').className).not.toContain(
            'line-through',
        );
    });

    it('links each todo name to its edit page', () => {
        renderList();
        expect(screen.getByText('active task').getAttribute('href')).toBe(
            '/edit/1',
        );
    });

    it('toggles a todo through the server with the new state', async () => {
        const user = userEvent.setup();
        renderList();
        await user.click(screen.getAllByRole('checkbox')[0]);
        expect(toggleSpy).toHaveBeenCalledWith({
            data: { id: '1', isComplete: true },
        });
    });

    it('opens an undo toast on delete and defers the server call', async () => {
        const user = userEvent.setup();
        renderList();
        await user.click(screen.getAllByLabelText('Delete task')[0]);

        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(vi.mocked(toast.warning).mock.calls[0][0]).toBe(
            'Deleted "active task"',
        );
        expect(lastUndoToastOptions().action).toMatchObject({ label: 'Undo' });
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('commits the delete when the undo window elapses', async () => {
        const user = userEvent.setup();
        renderList();
        await user.click(screen.getAllByLabelText('Delete task')[0]);

        await lastUndoToastOptions().onAutoClose?.();
        expect(deleteSpy).toHaveBeenCalledWith({ data: { id: '1' } });
    });

    it('does not delete on the server when undo is pressed', async () => {
        const user = userEvent.setup();
        renderList();
        await user.click(screen.getAllByLabelText('Delete task')[0]);

        const options = lastUndoToastOptions();
        options.action?.onClick();
        await options.onAutoClose?.();
        expect(deleteSpy).not.toHaveBeenCalled();
    });
});
