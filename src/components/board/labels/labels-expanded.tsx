import { createContext, use, useState } from 'react';
import type { ReactNode } from 'react';

// Labels on the board's card faces (#120): the board they come from and whether
// their titles are shown. A click on any label toggles all cards of the board;
// the state is not kept across reloads.

export interface BoardLabelsValue {
    boardId: string;
    expanded: boolean;
    toggle: () => void;
}

const BoardLabelsContext = createContext<BoardLabelsValue | null>(null);

export function LabelsExpandedProvider({
    boardId,
    children,
}: {
    boardId: string;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);
    return (
        <BoardLabelsContext
            value={{
                boardId,
                expanded,
                toggle: () => setExpanded((e) => !e),
            }}
        >
            {children}
        </BoardLabelsContext>
    );
}

/** Null outside a board (component tests of a single card show no labels). */
export function useBoardLabels() {
    return use(BoardLabelsContext);
}
