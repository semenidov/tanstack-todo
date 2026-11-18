import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getNearestSnapLeft, useDragScroll } from '#/lib/use-drag-scroll';

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

        fireEvent.pointerMove(board, { ...mouse, clientX: 20 });
        expect(board.scrollLeft).toBe(130);
        fireEvent.pointerMove(board, { ...mouse, clientX: 80 });
        expect(board.scrollLeft).toBe(70);

        fireEvent.pointerUp(board, { ...mouse, clientX: 20 });
        fireEvent.pointerMove(board, { ...mouse, clientX: 100 });
        expect(board.scrollLeft).toBe(70);
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
