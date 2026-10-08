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
import {
    SortableContext,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import type {
    Announcements,
    CollisionDetection,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    KeyboardCoordinateGetter,
    UniqueIdentifier,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMoveCard } from '#/components/board/card-mutations';
import { useMoveList } from '#/components/board/list-mutations';
import {
    cardMoveNeighbors,
    findCardInBoard,
    moveCardInBoard,
    moveListInBoard,
} from '#/lib/boards';
import { Badge } from '#/components/ui/badge';
import { boardQueryOptions } from '#/lib/boards-query';
import type { BoardData, ListWithCards } from '#/lib/boards-query';
import type { CardDndAnnouncerState } from '#/lib/card-dnd';
import {
    cardDndAnnouncements,
    cardDropTarget,
    cardKeyboardPoint,
    pickCardDropId,
} from '#/lib/card-dnd';
import type { ListDndAnnouncerState } from '#/lib/list-dnd';
import {
    isListId,
    listDndAnnouncements,
    listDropIndex,
    listKeyboardPoint,
    pickListDropId,
} from '#/lib/list-dnd';
import { useHydrated } from '#/lib/use-hydrated';
import { usePrefersReducedMotion } from '#/lib/use-prefers-reduced-motion';

// Space picks a card or a list up: Enter stays with the card link (opens the
// card) and the list title button (renames the list).
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

enum DragType {
    Card = 'card',
    List = 'list',
}

interface DragState {
    type: DragType;
    activeId: string;
    /** The lists at pick-up: the card goes back here when it leaves all lists. */
    startLists: Array<ListWithCards>;
    /**
     * The lists shown while dragging, with the card moved between lists. A list
     * is shown moved by the sortable transforms only: these stay as at pick-up.
     */
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
 * Drag-and-drop of cards inside and between lists and of lists inside the board
 * (mouse, touch, keyboard), in one context: nested contexts would not share the
 * sensors. Collision detection, arrow keys and announcements branch on the type
 * of the dragged item. While dragging, the board shows a local copy of the lists:
 * server data that arrives meanwhile is applied after the drop. The drop goes
 * through the same move queue as the Move windows.
 */
export function BoardDnd({ board, lists, children }: BoardDndProps) {
    const queryClient = useQueryClient();
    const { moveCardNextTo } = useMoveCard(board.id);
    const { moveList } = useMoveList(board.id);
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
                if (isListId(shownLists, active.id)) {
                    // A list goes by the center of the dragged column, by x only.
                    const id = pickListDropId(shownLists, droppableRects, {
                        x: collisionRect.left + collisionRect.width / 2,
                        y: collisionRect.top + collisionRect.height / 2,
                    });
                    return id === null ? [] : [{ id }];
                }
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
                if (isListId(shownListsRef.current, active)) {
                    const point = listKeyboardPoint(
                        shownListsRef.current,
                        droppableRects,
                        String(active),
                        over ? String(over.id) : null,
                        event.code,
                    );
                    // Sideways only: columns differ in height.
                    return (
                        point && {
                            x: point.x - collisionRect.width / 2,
                            y: collisionRect.top,
                        }
                    );
                }
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

    const announcerStateRef = useRef<
        CardDndAnnouncerState & ListDndAnnouncerState
    >({
        quietOverId: null,
    });
    const announcements = useMemo<Announcements>(() => {
        const cards = cardDndAnnouncements(
            shownLists,
            announcerStateRef.current,
        );
        const columns = listDndAnnouncements(
            shownLists,
            announcerStateRef.current,
        );
        const pick = (id: UniqueIdentifier) =>
            isListId(shownLists, id) ? columns : cards;
        return {
            onDragStart: (args) => pick(args.active.id).onDragStart(args),
            onDragMove: (args) => pick(args.active.id).onDragMove?.(args),
            onDragOver: (args) => pick(args.active.id).onDragOver(args),
            onDragEnd: (args) => pick(args.active.id).onDragEnd(args),
            onDragCancel: (args) => pick(args.active.id).onDragCancel(args),
        };
    }, [shownLists]);

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
            type: isListId(shownLists, active.id)
                ? DragType.List
                : DragType.Card,
            activeId: String(active.id),
            startLists: shownLists,
            lists: shownLists,
        });
    }

    function handleDragOver({ over }: DragOverEvent) {
        // A list is shown at its target by the sortable row itself.
        if (!drag || drag.type === DragType.List) return;
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
        if (drag.type === DragType.List) {
            handleListDrop(drag, String(over.id));
            return;
        }
        const target = cardDropTarget(
            drag.lists,
            drag.activeId,
            String(over.id),
        );
        if (!target) return;
        // Neighbors from the lists the user saw: the cache may have changed meanwhile.
        const neighbors = cardMoveNeighbors(
            { board, lists: drag.lists },
            drag.activeId,
            target.listId,
            target.index,
        );
        if (
            neighbors &&
            moveCardNextTo(drag.activeId, target.listId, neighbors)
        ) {
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

    function handleListDrop(state: DragState, overId: string) {
        const index = listDropIndex(state.lists, state.activeId, overId);
        if (index === undefined || !moveList(state.activeId, index)) return;
        setDropped({
            base: lists,
            lists: moveListInBoard(
                { board, lists: state.lists },
                state.activeId,
                index,
            ).lists,
        });
    }

    const activeCard =
        drag?.type === DragType.Card
            ? findCardInBoard({ board, lists: drag.lists }, drag.activeId)?.card
            : undefined;
    const activeList =
        drag?.type === DragType.List
            ? drag.lists.find((l) => l.id === drag.activeId)
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
            <SortableContext
                id="lists"
                items={shownLists.map((l) => l.id)}
                strategy={horizontalListSortingStrategy}
            >
                {children({ lists: shownLists, isDragging: drag !== null })}
            </SortableContext>
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
                        {activeList && (
                            <ListPreview
                                list={activeList}
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

// The column under the pointer while dragging: a static copy with all its cards,
// without the menu, AddCard and links.
function ListPreview({
    list,
    tilted,
}: {
    list: ListWithCards;
    tilted: boolean;
}) {
    return (
        <div
            className={cn(
                'flex h-full cursor-grabbing flex-col overflow-hidden rounded-lg border bg-card shadow-lg',
                tilted && 'rotate-2',
            )}
        >
            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
                <span className="truncate">{list.title}</span>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {list.cards.length}
                </Badge>
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
                {list.cards.map((card) => (
                    <li
                        key={card.id}
                        className="truncate rounded-md border bg-background px-3 py-2 text-sm shadow-xs"
                    >
                        {card.title}
                    </li>
                ))}
            </ul>
        </div>
    );
}
