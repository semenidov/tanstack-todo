import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    check,
    date,
    index,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export * from './auth-schema';

export const boards = pgTable(
    'boards',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        ownerId: text('owner_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp({ withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('boards_owner_id_idx').on(t.ownerId)],
);

export const lists = pgTable(
    'lists',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        boardId: uuid('board_id')
            .notNull()
            .references(() => boards.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        // Fractional-indexing key like cards.position: COLLATE "C" is set in the
        // migration (drizzle has no column collation).
        position: text('position').notNull(),
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp({ withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
    },
    (t) => [index('lists_board_id_position_idx').on(t.boardId, t.position)],
);

export const cards = pgTable(
    'cards',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        listId: uuid('list_id')
            .notNull()
            .references(() => lists.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        description: text('description'),
        // Fractional-indexing key, compared byte-wise: the column is COLLATE "C"
        // (set in the migration, drizzle has no column collation).
        position: text('position').notNull(),
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp({ withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        // null = not completed.
        completedAt: timestamp('completed_at', { withTimezone: true }),
        // Due date: either a whole day (a date without a time zone) or an exact
        // moment, never both (cards_due_check).
        dueDate: date('due_date', { mode: 'string' }),
        dueAt: timestamp('due_at', { withTimezone: true }),
    },
    (t) => [
        index('cards_list_id_position_idx').on(t.listId, t.position),
        // sql: drizzle has no builder for check expressions.
        check(
            'cards_due_check',
            sql`${t.dueDate} is null or ${t.dueAt} is null`,
        ),
    ],
);

// Labels belong to a board; their order is created_at, then id.
export const labels = pgTable(
    'labels',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        boardId: uuid('board_id')
            .notNull()
            .references(() => boards.id, { onDelete: 'cascade' }),
        // null = a color-only label.
        title: text('title'),
        // A palette token key (src/lib/label-colors.ts), not a hex color.
        color: text('color').notNull(),
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [
        index('labels_board_id_created_at_idx').on(t.boardId, t.createdAt),
        // Titles are unique on a board ignoring case; untitled labels repeat
        // freely. sql: drizzle has no builder for index expressions.
        uniqueIndex('labels_board_id_title_unique')
            .on(t.boardId, sql`lower(${t.title})`)
            .where(sql`${t.title} is not null`),
    ],
);

export const cardLabels = pgTable(
    'card_labels',
    {
        cardId: uuid('card_id')
            .notNull()
            .references(() => cards.id, { onDelete: 'cascade' }),
        labelId: uuid('label_id')
            .notNull()
            .references(() => labels.id, { onDelete: 'cascade' }),
    },
    (t) => [
        primaryKey({ columns: [t.cardId, t.labelId] }),
        index('card_labels_label_id_idx').on(t.labelId),
    ],
);

// One checklist per card.
export const checklists = pgTable('checklists', {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id')
        .notNull()
        .unique()
        .references(() => cards.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const checklistItems = pgTable(
    'checklist_items',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        checklistId: uuid('checklist_id')
            .notNull()
            .references(() => checklists.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        done: boolean('done').default(false).notNull(),
        // Fractional-indexing key like cards.position: COLLATE "C" is set in the
        // migration (drizzle has no column collation).
        position: text('position').notNull(),
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [
        index('checklist_items_checklist_id_position_idx').on(
            t.checklistId,
            t.position,
        ),
    ],
);

export const boardsRelations = relations(boards, ({ many }) => ({
    lists: many(lists),
    labels: many(labels),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
    board: one(boards, {
        fields: [lists.boardId],
        references: [boards.id],
    }),
    cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
    list: one(lists, {
        fields: [cards.listId],
        references: [lists.id],
    }),
    cardLabels: many(cardLabels),
    checklist: one(checklists),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
    board: one(boards, {
        fields: [labels.boardId],
        references: [boards.id],
    }),
    cardLabels: many(cardLabels),
}));

export const cardLabelsRelations = relations(cardLabels, ({ one }) => ({
    card: one(cards, {
        fields: [cardLabels.cardId],
        references: [cards.id],
    }),
    label: one(labels, {
        fields: [cardLabels.labelId],
        references: [labels.id],
    }),
}));

export const checklistsRelations = relations(checklists, ({ one, many }) => ({
    card: one(cards, {
        fields: [checklists.cardId],
        references: [cards.id],
    }),
    items: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
    checklist: one(checklists, {
        fields: [checklistItems.checklistId],
        references: [checklists.id],
    }),
}));
