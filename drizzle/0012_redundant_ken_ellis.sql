-- Hand-edited: checklist_items.position is COLLATE "C" (byte-wise fractional-indexing
-- keys, like cards.position; drizzle has no column collation).
CREATE TABLE "card_labels" (
	"card_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "card_labels_card_id_label_id_pk" PRIMARY KEY("card_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"title" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklists_card_id_unique" UNIQUE("card_id")
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"title" text,
	"color" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "card_labels" ADD CONSTRAINT "card_labels_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_labels" ADD CONSTRAINT "card_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_labels_label_id_idx" ON "card_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "checklist_items_checklist_id_position_idx" ON "checklist_items" USING btree ("checklist_id","position");--> statement-breakpoint
CREATE INDEX "labels_board_id_created_at_idx" ON "labels" USING btree ("board_id","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_board_id_title_unique" ON "labels" USING btree ("board_id",lower("title")) WHERE "labels"."title" is not null;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_due_check" CHECK ("cards"."due_date" is null or "cards"."due_at" is null);