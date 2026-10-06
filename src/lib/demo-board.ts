// Content of the demo board a guest gets on sign-in (#84). Plain data: lists
// left to right, cards top to bottom; seeded by `seedDemoBoard` in boards-repo.

export interface DemoCard {
    title: string;
    description: string;
}

export interface DemoList {
    title: string;
    cards: Array<DemoCard>;
}

export const DEMO_BOARD: { title: string; lists: Array<DemoList> } = {
    title: 'Todo app roadmap',
    lists: [
        {
            title: 'Backlog',
            cards: [
                {
                    title: 'Drag-and-drop lists',
                    description: 'Reorder lists the same way as cards.',
                },
                {
                    title: 'Card due dates and labels',
                    description: 'Deadlines and colored labels on cards.',
                },
                {
                    title: 'Shared boards with roles',
                    description:
                        'Invite people as editors or viewers; access checks on every query.',
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
                },
                {
                    title: 'Undo on delete',
                    description:
                        'Optimistic delete with an Undo toast backed by soft delete.',
                },
                {
                    title: 'Dark mode',
                    description: 'System, light and dark themes.',
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
