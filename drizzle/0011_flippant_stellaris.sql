DROP INDEX "lists_board_id_created_at_idx";--> statement-breakpoint
-- Hand-edited: the column is added nullable with byte-wise collation, backfilled
-- (oldest first, like the old asc(created_at) order, deleted lists included so
-- Undo restores them in place), then made NOT NULL. Keys match
-- generateNKeysBetween(null, null, n) from fractional-indexing: a0..az, then
-- b00..bzz (up to 62 + 62 * 62 = 3906 per board).
ALTER TABLE "lists" ADD COLUMN "position" text COLLATE "C";--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "lists" GROUP BY "board_id" HAVING count(*) > 3906) THEN
    RAISE EXCEPTION 'position backfill supports up to 3906 lists per board';
  END IF;
END $$;--> statement-breakpoint
WITH ranked AS (
  SELECT "id", (row_number() OVER (PARTITION BY "board_id" ORDER BY "createdAt" ASC, "id") - 1)::int AS n
  FROM "lists"
)
UPDATE "lists" l SET "position" = CASE
  WHEN r.n < 62 THEN 'a' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', r.n + 1, 1)
  ELSE 'b' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (r.n - 62) / 62 + 1, 1)
           || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (r.n - 62) % 62 + 1, 1)
END
FROM ranked r WHERE l."id" = r."id";--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "lists_board_id_position_idx" ON "lists" USING btree ("board_id","position");
