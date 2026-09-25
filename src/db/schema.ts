import {
    boolean,
    index,
    pgTable,
    text,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export * from './auth-schema';

export const todos = pgTable(
    'todos',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        isComplete: boolean().notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp({ withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('todos_user_id_created_at_idx').on(t.userId, t.createdAt)],
);
