// `!`: the container's resting `md:cursor-grab` comes later in the stylesheet and would win.
const DRAGGING_CLASSES = ['select-none', 'cursor-grabbing!'];
// Fallback for browsers without `scrollend`: the smooth settle is done well before this.
const SETTLE_FALLBACK_MS = 600;

export function getDragScrollLeft(
    startScrollLeft: number,
    startX: number,
    clientX: number,
): number {
    return startScrollLeft - (clientX - startX);
}

// Snap point closest to the current position; null when there is none.
export function getNearestSnapLeft(
    snapLefts: number[],
    scrollLeft: number,
): number | null {
    let nearest: number | null = null;
    for (const left of snapLefts) {
        if (
            nearest === null ||
            Math.abs(left - scrollLeft) < Math.abs(nearest - scrollLeft)
        ) {
            nearest = left;
        }
    }
    return nearest;
}

// scrollLeft at which each child lands on its own `scroll-snap-align` (start/center/end).
function getSnapLefts(container: HTMLElement): number[] {
    const box = container.getBoundingClientRect();
    const viewportLeft = box.left + container.clientLeft;
    const maxLeft = container.scrollWidth - container.clientWidth;
    // CSS snap aligns to the snapport inset by scroll-padding; 'auto' parses to NaN -> 0.
    const style = getComputedStyle(container);
    const padLeft = parseFloat(style.scrollPaddingLeft) || 0;
    const padRight = parseFloat(style.scrollPaddingRight) || 0;
    const lefts: number[] = [];
    for (const child of container.children) {
        const align = getComputedStyle(child).scrollSnapAlign.split(' ').at(-1);
        if (align !== 'start' && align !== 'center' && align !== 'end')
            continue;
        const rect = child.getBoundingClientRect();
        const offset = rect.left - viewportLeft + container.scrollLeft;
        const left =
            align === 'start'
                ? offset - padLeft
                : align === 'center'
                  ? offset + rect.width / 2 - container.clientWidth / 2
                  : offset + rect.width - container.clientWidth + padRight;
        lefts.push(Math.min(Math.max(left, 0), maxLeft));
    }
    return lefts;
}

interface DragState {
    pointerId: number;
    startX: number;
    startScrollLeft: number;
}

function attachDragScroll(container: HTMLElement): () => void {
    let drag: DragState | null = null;
    let cancelSettle: (() => void) | null = null;

    // Snap stays off while the board settles, otherwise the browser jumps to a snap point.
    function restoreSnap() {
        cancelSettle?.();
        cancelSettle = null;
        container.style.scrollSnapType = '';
    }

    // Glide to the nearest column, then hand control back to CSS scroll-snap.
    function settle() {
        const target = getNearestSnapLeft(
            getSnapLefts(container),
            container.scrollLeft,
        );
        if (target === null || Math.abs(target - container.scrollLeft) < 1) {
            restoreSnap();
            return;
        }
        const timer = window.setTimeout(restoreSnap, SETTLE_FALLBACK_MS);
        container.addEventListener('scrollend', restoreSnap, { once: true });
        cancelSettle = () => {
            window.clearTimeout(timer);
            container.removeEventListener('scrollend', restoreSnap);
        };
        container.scrollTo({ left: target, behavior: 'smooth' });
    }

    function handlePointerDown(e: PointerEvent) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (e.target !== e.currentTarget) return;
        cancelSettle?.();
        cancelSettle = null;
        drag = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startScrollLeft: container.scrollLeft,
        };
        container.setPointerCapture(e.pointerId);
        container.classList.add(...DRAGGING_CLASSES);
        // Inline `none` beats any snap class: Tailwind's `snap-x` alone still snaps
        // (`proximity`) and pulls the board back on every move - the jerky pan (#43).
        container.style.scrollSnapType = 'none';
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
        drag = null;
        settle();
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerEnd);
    container.addEventListener('pointercancel', handlePointerEnd);
    return () => {
        cancelSettle?.();
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
 * The board follows the mouse freely (scroll-snap off) and glides to the nearest column
 * on release, using each child's `scroll-snap-align`.
 * Returns a callback ref (React 19 ref cleanup): the container may mount later than the
 * component (board goes from empty to non-empty), which a ref object + effect would miss.
 * Drag state lives in a closure, so pointermove causes no re-renders.
 */
export function useDragScroll() {
    return dragScrollRef;
}
