import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp({ withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('lists_board_id_created_at_idx').on(t.boardId, t.createdAt)],
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
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp({ withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('cards_list_id_created_at_idx').on(t.listId, t.createdAt)],
);

export const boardsRelations = relations(boards, ({ many }) => ({
    lists: many(lists),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
    board: one(boards, {
        fields: [lists.boardId],
        references: [boards.id],
    }),
    cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
    list: one(lists, {
        fields: [cards.listId],
        references: [lists.id],
    }),
}));
