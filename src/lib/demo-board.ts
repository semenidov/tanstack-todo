import { LabelColor } from '#/lib/label-colors';

export interface DemoCard {
    title: string;
    description: string;
    completed?: boolean;
    dueInDays?: number;
    labels?: Array<string>;
    checklist?: DemoChecklist;
}

export interface DemoChecklist {
    title: string;
    items: Array<{ title: string; done?: boolean }>;
}

export interface DemoLabel {
    title: string;
    color: LabelColor;
}

export interface DemoList {
    title: string;
    cards: Array<DemoCard>;
}

export const DEMO_BOARD: {
    title: string;
    labels: Array<DemoLabel>;
    lists: Array<DemoList>;
} = {
    title: 'Todo app roadmap',
    labels: [
        { title: 'Feature', color: LabelColor.Green },
        { title: 'UX', color: LabelColor.Purple },
        { title: 'Backend', color: LabelColor.Blue },
        { title: 'Infra', color: LabelColor.Orange },
    ],
    lists: [
        {
            title: 'Backlog',
            cards: [
                {
                    title: 'Drag-and-drop lists',
                    description: 'Reorder lists the same way as cards.',
                    dueInDays: -2,
                    labels: ['Feature', 'UX'],
                },
                {
                    title: 'Card due dates and labels',
                    description: 'Deadlines and colored labels on cards.',
                    dueInDays: 0,
                    labels: ['Feature'],
                    checklist: {
                        title: 'Card details',
                        items: [
                            { title: 'Labels', done: true },
                            { title: 'Due dates', done: true },
                            { title: 'Checklists' },
                            { title: 'Mark as done' },
                        ],
                    },
                },
                {
                    title: 'Shared boards with roles',
                    description:
                        'Invite people as editors or viewers; access checks on every query.',
                    labels: ['Feature', 'Backend'],
                },
            ],
        },
        {
            title: 'In progress',
            cards: [
                {
                    title: '👋 Try me: drag this card to Done',
                    description:
                        'Drag cards with the mouse, a long press on touch, or Space + arrow keys. Changes are saved instantly.',
                },
                {
                    title: 'Guest sandbox',
                    description:
                        "You're in it: a private demo board deleted after 7 days.",
                    labels: ['Infra'],
                },
            ],
        },
        {
            title: 'Done',
            cards: [
                {
                    title: 'Boards, lists and cards',
                    description:
                        'TanStack Start + Drizzle + Postgres, every query scoped to the owner.',
                    completed: true,
                    labels: ['Backend'],
                },
                {
                    title: 'Undo on delete',
                    description:
                        'Optimistic delete with an Undo toast backed by soft delete.',
                },
                {
                    title: 'Dark mode',
                    description: 'System, light and dark themes.',
                    labels: ['UX'],
                },
                {
                    title: 'Drag-and-drop cards',
                    description:
                        'Fractional indexing: one row updated per move, server-generated keys.',
                },
            ],
        },
    ],
};
