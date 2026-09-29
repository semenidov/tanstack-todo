ALTER TABLE "todos" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "todos" CASCADE;--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_legacy_todo_id_unique";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "legacy_todo_id";