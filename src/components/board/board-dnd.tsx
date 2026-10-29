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
import { CardFace } from '#/components/board/card-face';
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
import type { BoardData, Card, ListWithCards } from '#/lib/boards-query';
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

const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

enum DragType {
    Card = 'card',
    List = 'list',
}

interface DragState {
    type: DragType;
    activeId: string;
    startLists: Array<ListWithCards>;
    lists: Array<ListWithCards>;
}

interface DroppedState {
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

export function BoardDnd({ board, lists, children }: BoardDndProps) {
    const queryClient = useQueryClient();
    const { moveCardNextTo } = useMoveCard(board.id);
    const { moveList } = useMoveList(board.id);
    const reducedMotion = usePrefersReducedMotion();
    const hydrated = useHydrated();
    const [drag, setDrag] = useState<DragState | null>(null);
    const [dropped, setDropped] = useState<DroppedState | null>(null);

    // The cache updates a tick before the `lists` prop: keep the drop, or the
    // card flashes back.
    const shownLists = drag
        ? drag.lists
        : dropped && dropped.base === lists
          ? dropped.lists
          : lists;

    const shownListsRef = useRef(shownLists);
    useLayoutEffect(() => {
        shownListsRef.current = shownLists;
    });

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
        if (!drag || drag.type === DragType.List) return;
        if (!over) {
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
                                card={activeCard}
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

function CardPreview({ card, tilted }: { card: Card; tilted: boolean }) {
    return (
        <div
            className={cn(
                'h-full cursor-grabbing rounded-md border bg-background shadow-lg',
                tilted && 'rotate-3',
            )}
        >
            <CardFace card={card} />
        </div>
    );
}

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
                        className="rounded-md border bg-background shadow-xs"
                    >
                        <CardFace card={card} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
