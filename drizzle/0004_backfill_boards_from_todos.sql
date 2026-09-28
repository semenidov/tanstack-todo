-- 1. Board for every user who has todos and no boards yet
INSERT INTO boards (owner_id, title)
SELECT DISTINCT t.user_id, 'My tasks'
FROM todos t
WHERE NOT EXISTS (SELECT 1 FROM boards b WHERE b.owner_id = t.user_id);
--> statement-breakpoint
-- 2. "To do" and "Done" lists for boards without lists
INSERT INTO lists (board_id, title, "createdAt")
SELECT b.id, v.title, now() + v.shift
FROM boards b
CROSS JOIN (VALUES ('To do', interval '0'), ('Done', interval '1 millisecond')) AS v(title, shift)
WHERE NOT EXISTS (SELECT 1 FROM lists l WHERE l.board_id = b.id);
--> statement-breakpoint
-- 3. Copy todos not copied yet
INSERT INTO cards (list_id, title, legacy_todo_id, "createdAt", "updatedAt")
SELECT l.id, t.name, t.id, t."createdAt", t."updatedAt"
FROM todos t
JOIN boards b ON b.owner_id = t.user_id AND b.title = 'My tasks'
JOIN lists l ON l.board_id = b.id
  AND l.title = CASE WHEN t."isComplete" THEN 'Done' ELSE 'To do' END
WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.legacy_todo_id = t.id);
