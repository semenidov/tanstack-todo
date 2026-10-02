ALTER TABLE "cards" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "deleted_at" timestamp with time zone;