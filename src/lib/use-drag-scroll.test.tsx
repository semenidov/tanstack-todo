import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    getDragScrollLeft,
    getNearestSnapLeft,
    useDragScroll,
} from '#/lib/use-drag-scroll';

describe('getDragScrollLeft', () => {
    it('scrolls opposite to the mouse movement', () => {
        expect(getDragScrollLeft(100, 50, 20)).toBe(130);
        expect(getDragScrollLeft(100, 50, 80)).toBe(70);
    });

    it('keeps the start position when the mouse has not moved', () => {
        expect(getDragScrollLeft(100, 50, 50)).toBe(100);
    });
});

describe('getNearestSnapLeft', () => {
    it('picks the snap point closest to the release position', () => {
        expect(getNearestSnapLeft([0, 300, 600], 420)).toBe(300);
        expect(getNearestSnapLeft([0, 300, 600], 480)).toBe(600);
    });

    it('returns null when there are no snap points', () => {
        expect(getNearestSnapLeft([], 120)).toBeNull();
    });
});

function Board() {
    const ref = useDragScroll();
    return (
        <div ref={ref} data-testid="board" className="snap-mandatory">
            <button type="button">Card</button>
        </div>
    );
}

const mouse = { pointerId: 1, pointerType: 'mouse', button: 0 };

describe('useDragScroll', () => {
    beforeAll(() => {
        // jsdom has no pointer capture API.
        HTMLElement.prototype.setPointerCapture = vi.fn();
        HTMLElement.prototype.releasePointerCapture = vi.fn();
        HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    });

    it('pans when dragging the container background', () => {
        render(<Board />);
        const board = screen.getByTestId('board');
        board.scrollLeft = 100;

        fireEvent.pointerDown(board, { ...mouse, clientX: 50 });
        expect(board).toHaveClass('select-none', 'cursor-grabbing!');
        // Snap is off for the whole drag, so the board follows the mouse freely.
        expect(board.style.scrollSnapType).toBe('none');

        fireEvent.pointerMove(board, { ...mouse, clientX: 20 });
        expect(board.scrollLeft).toBe(130);

        fireEvent.pointerUp(board, { ...mouse, clientX: 20 });
        expect(board).not.toHaveClass('select-none', 'cursor-grabbing!');
        // No snap-aligned children here: nothing to glide to, snap is handed back to CSS.
        expect(board.style.scrollSnapType).toBe('');
    });

    it('does not start on a descendant', () => {
        render(<Board />);
        const board = screen.getByTestId('board');
        board.scrollLeft = 100;

        fireEvent.pointerDown(screen.getByRole('button'), {
            ...mouse,
            clientX: 50,
        });
        fireEvent.pointerMove(board, { ...mouse, clientX: 20 });

        expect(board.scrollLeft).toBe(100);
        expect(board).not.toHaveClass('cursor-grabbing!');
    });

    it('ignores touch input', () => {
        render(<Board />);
        const board = screen.getByTestId('board');
        board.scrollLeft = 100;

        fireEvent.pointerDown(board, {
            ...mouse,
            pointerType: 'touch',
            clientX: 50,
        });
        fireEvent.pointerMove(board, {
            ...mouse,
            pointerType: 'touch',
            clientX: 20,
        });

        expect(board.scrollLeft).toBe(100);
    });
});
