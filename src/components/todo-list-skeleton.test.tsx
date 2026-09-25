import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TodoListSkeleton } from '#/components/todo-list-skeleton';

describe('TodoListSkeleton', () => {
    it('renders with aria-busy for assistive tech', () => {
        render(<TodoListSkeleton />);
        expect(screen.getByLabelText('Loading tasks')).toHaveAttribute(
            'aria-busy',
            'true',
        );
    });

    it('renders the expected number of skeleton placeholders', () => {
        const { container } = render(<TodoListSkeleton />);
        // 2 header placeholders (buttons) + 4 rows * 2 placeholders (checkbox + text)
        expect(
            container.querySelectorAll('[data-slot="skeleton"]'),
        ).toHaveLength(10);
    });
});
