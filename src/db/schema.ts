import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export * from './auth-schema';

export const todos = pgTable('todos', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isComplete: boolean().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
});
