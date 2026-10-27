import { createContext, use, useState } from 'react';
import type { ReactNode } from 'react';

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

export function useBoardLabels() {
    return use(BoardLabelsContext);
}
