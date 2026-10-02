import {
    DndContext,
    DragOverlay,
    KeyboardCode,
    KeyboardSensor,
    MeasuringStrategy,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type {
    CollisionDetection,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMoveCard } from '#/components/board/card-mutations';
import { findCardInBoard, moveCardInBoard } from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, ListWithCards } from '#/lib/boards-query';
import type { CardDndAnnouncerState } from '#/lib/card-dnd';
import {
    cardDndAnnouncements,
    cardDropTarget,
    cardKeyboardPoint,
    pickCardDropId,
} from '#/lib/card-dnd';
import { usePrefersReducedMotion } from '#/lib/use-prefers-reduced-motion';

// Space picks a card up: Enter stays with the card link and opens the card.
const KEYBOARD_CODES = {
    start: [KeyboardCode.Space],
    cancel: [KeyboardCode.Esc],
    end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab],
};

const ARROW_CODES: Array<string> = [
    KeyboardCode.Up,
    KeyboardCode.Down,
    KeyboardCode.Left,
    KeyboardCode.Right,
];

// Lists change height while a card moves between them: measure them all the time.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

const subscribeNoop = () => () => {};
function useHydrated() {
    return useSyncExternalStore(
        subscribeNoop,
        () => true,
        () => false,
    );
}

interface DragState {
    activeId: string;
    /** The lists at pick-up: the card goes back here when it leaves all lists. */
    startLists: Array<ListWithCards>;
    /** The lists shown while dragging, with the card moved between lists. */
    lists: Array<ListWithCards>;
}

interface DroppedState {
    /** The `lists` prop at the drop: shown until the cache brings the move. */
    base: Array<ListWithCards>;
    lists: Array<ListWithCards>;
}

interface BoardDndProps {
    board: BoardData['board'];
    lists: Array<ListWithCards>;
    children: (props: {
        lists: Array<ListWithCards>;
        isDragging: boolean;
    }) => ReactNode;
}

/**
 * Drag-and-drop of cards inside and between lists (mouse, touch, keyboard).
 * While a card is dragged, the board shows a local copy of the lists: server data
 * that arrives meanwhile is applied after the drop. The drop goes through the same
 * move queue as the Move window.
 */
export function BoardDnd({ board, lists, children }: BoardDndProps) {
    const queryClient = useQueryClient();
    const { moveCard } = useMoveCard(board.id);
    const reducedMotion = usePrefersReducedMotion();
    const hydrated = useHydrated();
    const [drag, setDrag] = useState<DragState | null>(null);
    const [dropped, setDropped] = useState<DroppedState | null>(null);

    // The drop is in the cache already, but the new `lists` prop comes a tick later:
    // keep showing the drop so the card doesn't flash back to where it was.
    const shownLists = drag
        ? drag.lists
        : dropped && dropped.base === lists
          ? dropped.lists
          : lists;

    // The keyboard sensor keeps its options from the pick-up: read lists through a ref.
    const shownListsRef = useRef(shownLists);
    useLayoutEffect(() => {
        shownListsRef.current = shownLists;
    });

    // Right after the card moves to another list the measured rects are stale and
    // would bounce it back: keep it over itself until the next frame.
    const justMovedToListRef = useRef(false);
    useEffect(() => {
        if (!justMovedToListRef.current) return;
        const frame = requestAnimationFrame(() => {
            justMovedToListRef.current = false;
        });
        return () => cancelAnimationFrame(frame);
    }, [drag?.lists]);

    const collisionDetection = useMemo<CollisionDetection>(
        () =>
            ({ active, collisionRect, droppableRects, pointerCoordinates }) => {
                if (justMovedToListRef.current) return [{ id: active.id }];
                const point = pointerCoordinates ?? {
                    x: collisionRect.left + collisionRect.width / 2,
                    y: collisionRect.top + collisionRect.height / 2,
                };
                const id = pickCardDropId(
                    shownLists,
                    droppableRects,
                    point,
                    pointerCoordinates === null,
                );
                return id === null ? [] : [{ id }];
            },
        [shownLists],
    );

    const coordinateGetter = useMemo<KeyboardCoordinateGetter>(
        () =>
            (
                event,
                { active, context: { over, collisionRect, droppableRects } },
            ) => {
                if (!ARROW_CODES.includes(event.code)) return undefined;
                event.preventDefault();
                if (!collisionRect) return undefined;
                const point = cardKeyboardPoint(
                    shownListsRef.current,
                    droppableRects,
                    String(active),
                    over ? String(over.id) : null,
                    event.code,
                );
                return (
                    point && {
                        x: point.x - collisionRect.width / 2,
                        y: point.y - collisionRect.height / 2,
                    }
                );
            },
        [],
    );

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            keyboardCodes: KEYBOARD_CODES,
            coordinateGetter,
        }),
    );

    const announcerStateRef = useRef<CardDndAnnouncerState>({
        quietOverId: null,
    });
    const announcements = useMemo(
        () => cardDndAnnouncements(shownLists, announcerStateRef.current),
        [shownLists],
    );

    const moveInLists = (
        from: Array<ListWithCards>,
        cardId: string,
        listId: string,
        index: number,
    ) => moveCardInBoard({ board, lists: from }, cardId, listId, index).lists;

    function handleDragStart({ active }: DragStartEvent) {
        // A refetch in flight must not land in the middle of the drag.
        void queryClient.cancelQueries({
            queryKey: boardQueryOptions(board.id).queryKey,
        });
        setDropped(null);
        setDrag({
            activeId: String(active.id),
            startLists: shownLists,
            lists: shownLists,
        });
    }

    function handleDragOver({ over }: DragOverEvent) {
        if (!drag) return;
        if (!over) {
            // Outside the lists: the placeholder goes back where the card was.
            if (drag.lists !== drag.startLists) {
                setDrag({ ...drag, lists: drag.startLists });
            }
            return;
        }
        const from = findCardInBoard(
            { board, lists: drag.lists },
            drag.activeId,
        );
        const target = cardDropTarget(
            drag.lists,
            drag.activeId,
            String(over.id),
        );
        if (!from || !target) return;
        const fromIndex = from.list.cards.findIndex(
            (c) => c.id === drag.activeId,
        );
        if (target.listId === from.list.id) {
            // Over a card of its own list the sortable list shows the move itself;
            // over the list (below the last card) move the card to the end.
            if (over.id !== from.list.id || target.index === fromIndex) return;
        } else {
            justMovedToListRef.current = true;
        }
        setDrag({
            ...drag,
            lists: moveInLists(
                drag.lists,
                drag.activeId,
                target.listId,
                target.index,
            ),
        });
    }

    function handleDragEnd({ over }: DragEndEvent) {
        setDrag(null);
        if (!drag || !over) return;
        const target = cardDropTarget(
            drag.lists,
            drag.activeId,
            String(over.id),
        );
        if (!target) return;
        if (moveCard(drag.activeId, target.listId, target.index)) {
            setDropped({
                base: lists,
                lists: moveInLists(
                    drag.lists,
                    drag.activeId,
                    target.listId,
                    target.index,
                ),
            });
        }
    }

    const activeCard = drag
        ? findCardInBoard({ board, lists: drag.lists }, drag.activeId)?.card
        : undefined;

    return (
        <DndContext
            // A fixed id keeps aria-describedby the same on the server and the client.
            id="card-dnd"
            sensors={sensors}
            collisionDetection={collisionDetection}
            measuring={MEASURING}
            accessibility={{ announcements }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDrag(null)}
        >
            {children({ lists: shownLists, isDragging: drag !== null })}
            {hydrated &&
                createPortal(
                    <DragOverlay
                        dropAnimation={reducedMotion ? null : undefined}
                    >
                        {activeCard && (
                            <CardPreview
                                title={activeCard.title}
                                tilted={!reducedMotion}
                            />
                        )}
                    </DragOverlay>,
                    document.body,
                )}
        </DndContext>
    );
}

// The card under the pointer while dragging: a static copy without the link and menu.
function CardPreview({ title, tilted }: { title: string; tilted: boolean }) {
    return (
        <div
            className={cn(
                'h-full cursor-grabbing rounded-md border bg-background shadow-lg',
                tilted && 'rotate-3',
            )}
        >
            <div className="truncate px-3 py-2 pr-8 text-sm">{title}</div>
        </div>
    );
}
