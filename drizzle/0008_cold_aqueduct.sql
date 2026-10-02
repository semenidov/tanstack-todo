DROP INDEX "cards_list_id_created_at_idx";--> statement-breakpoint
-- Hand-edited: the column is added nullable with byte-wise collation, backfilled
-- (newest first, like the old desc(created_at) order, deleted cards included),
-- then made NOT NULL. Keys match generateNKeysBetween(null, null, n) from
-- fractional-indexing: a0..az, then b00..bzz (up to 62 + 62 * 62 = 3906 per list).
ALTER TABLE "cards" ADD COLUMN "position" text COLLATE "C";--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "cards" GROUP BY "list_id" HAVING count(*) > 3906) THEN
    RAISE EXCEPTION 'position backfill supports up to 3906 cards per list';
  END IF;
END $$;--> statement-breakpoint
WITH ranked AS (
  SELECT "id", (row_number() OVER (PARTITION BY "list_id" ORDER BY "createdAt" DESC, "id") - 1)::int AS n
  FROM "cards"
)
UPDATE "cards" c SET "position" = CASE
  WHEN r.n < 62 THEN 'a' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', r.n + 1, 1)
  ELSE 'b' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (r.n - 62) / 62 + 1, 1)
           || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (r.n - 62) % 62 + 1, 1)
END
FROM ranked r WHERE c."id" = r."id";--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "cards_list_id_position_idx" ON "cards" USING btree ("list_id","position");
