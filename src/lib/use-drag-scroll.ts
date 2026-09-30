// `!`: the container's resting `md:cursor-grab` comes later in the stylesheet and would win.
const DRAGGING_CLASSES = ['select-none', 'cursor-grabbing!'];
// Scroll-snap pulls the container back to a snap point on every scrollLeft change.
const SNAP_CLASS = 'snap-mandatory';

export function getDragScrollLeft(
    startScrollLeft: number,
    startX: number,
    clientX: number,
): number {
    return startScrollLeft - (clientX - startX);
}

interface DragState {
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    hadSnap: boolean;
}

function attachDragScroll(container: HTMLElement): () => void {
    let drag: DragState | null = null;

    function handlePointerDown(e: PointerEvent) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (e.target !== e.currentTarget) return;
        drag = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startScrollLeft: container.scrollLeft,
            hadSnap: container.classList.contains(SNAP_CLASS),
        };
        container.setPointerCapture(e.pointerId);
        container.classList.add(...DRAGGING_CLASSES);
        container.classList.remove(SNAP_CLASS);
    }

    function handlePointerMove(e: PointerEvent) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        container.scrollLeft = getDragScrollLeft(
            drag.startScrollLeft,
            drag.startX,
            e.clientX,
        );
    }

    function handlePointerEnd(e: PointerEvent) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        if (container.hasPointerCapture(e.pointerId)) {
            container.releasePointerCapture(e.pointerId);
        }
        container.classList.remove(...DRAGGING_CLASSES);
        if (drag.hadSnap) container.classList.add(SNAP_CLASS);
        drag = null;
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerEnd);
    container.addEventListener('pointercancel', handlePointerEnd);
    return () => {
        container.removeEventListener('pointerdown', handlePointerDown);
        container.removeEventListener('pointermove', handlePointerMove);
        container.removeEventListener('pointerup', handlePointerEnd);
        container.removeEventListener('pointercancel', handlePointerEnd);
    };
}

function dragScrollRef(el: HTMLElement | null) {
    return el ? attachDragScroll(el) : undefined;
}

/**
 * Horizontal pan by dragging the container's own background with the mouse.
 * Presses on descendants (columns, cards, buttons, inputs) and touch/pen input are ignored.
 * Returns a callback ref (React 19 ref cleanup): the container may mount later than the
 * component (board goes from empty to non-empty), which a ref object + effect would miss.
 * Drag state lives in a closure, so pointermove causes no re-renders.
 */
export function useDragScroll() {
    return dragScrollRef;
}
