-- Shared categories across editions (#338).
--
-- Tracks recur year after year, but Category carried a mandatory editionId: the
-- same track had to be recreated for every edition, with no link between the
-- copies. Category becomes a global entity, and each edition opts in through the
-- EditionCategory join — the split SponsorTier / EditionSponsorTier introduced
-- in #316.
--
-- DESTRUCTIVE at the end: the backfill (step 2) MUST run before the drop
-- (step 4). Existing rows are copied into the join keyed on their current
-- editionId, and only then is Category.editionId removed.
--
-- Duplicate names across editions would collide with the new global unique
-- index on nameFr. Step 1 folds them into a single row first, repointing both
-- the talks and the join rows, so no data is lost even if two editions had
-- declared the same track separately.

-- 1. Join table.
CREATE TABLE "EditionCategory" (
  "id" SERIAL PRIMARY KEY,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "editionId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "EditionCategory_editionId_categoryId_key" ON "EditionCategory"("editionId", "categoryId");
CREATE INDEX "EditionCategory_editionId_idx" ON "EditionCategory"("editionId");
CREATE INDEX "EditionCategory_categoryId_idx" ON "EditionCategory"("categoryId");
ALTER TABLE "EditionCategory"
  ADD CONSTRAINT "EditionCategory_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionCategory"
  ADD CONSTRAINT "EditionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Carry every current (category, edition) pair into the join, preserving the
-- per-edition display order.
INSERT INTO "EditionCategory" ("editionId", "categoryId", "sortOrder", "updatedAt")
SELECT c."editionId", c."id", c."sortOrder", CURRENT_TIMESTAMP
FROM "Category" c
ON CONFLICT ("editionId", "categoryId") DO NOTHING;

-- 3. Deduplicate by name before the global unique index can reject it. The
-- lowest id wins; talks and join rows of the losers are repointed to it, then
-- the duplicate rows are removed.
WITH canonical AS (
  SELECT "nameFr", MIN("id") AS keep_id
  FROM "Category"
  GROUP BY "nameFr"
  HAVING COUNT(*) > 1
),
losers AS (
  SELECT c."id" AS dup_id, k.keep_id
  FROM "Category" c
  JOIN canonical k ON k."nameFr" = c."nameFr"
  WHERE c."id" <> k.keep_id
)
UPDATE "Talk" t
SET "categoryId" = l.keep_id
FROM losers l
WHERE t."categoryId" = l.dup_id;

WITH canonical AS (
  SELECT "nameFr", MIN("id") AS keep_id
  FROM "Category"
  GROUP BY "nameFr"
  HAVING COUNT(*) > 1
),
losers AS (
  SELECT c."id" AS dup_id, k.keep_id
  FROM "Category" c
  JOIN canonical k ON k."nameFr" = c."nameFr"
  WHERE c."id" <> k.keep_id
)
UPDATE "EditionCategory" ec
SET "categoryId" = l.keep_id
FROM losers l
WHERE ec."categoryId" = l.dup_id
  -- Skip rows that would collide with a pair already pointing at the winner.
  AND NOT EXISTS (
    SELECT 1 FROM "EditionCategory" other
    WHERE other."editionId" = ec."editionId" AND other."categoryId" = l.keep_id
  );

-- Any join row left on a loser is a duplicate pair; drop it before the delete.
DELETE FROM "EditionCategory" ec
USING "Category" c, (
  SELECT "nameFr", MIN("id") AS keep_id FROM "Category" GROUP BY "nameFr" HAVING COUNT(*) > 1
) k
WHERE ec."categoryId" = c."id" AND c."nameFr" = k."nameFr" AND c."id" <> k.keep_id;

DELETE FROM "Category" c
USING (
  SELECT "nameFr", MIN("id") AS keep_id FROM "Category" GROUP BY "nameFr" HAVING COUNT(*) > 1
) k
WHERE c."nameFr" = k."nameFr" AND c."id" <> k.keep_id;

-- 4. DESTRUCTIVE — the edition link now lives in the join.
DROP INDEX IF EXISTS "Category_editionId_idx";
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_editionId_fkey";
ALTER TABLE "Category" DROP COLUMN "editionId";
-- sortOrder moves to the join: display order is a per-edition editorial choice.
ALTER TABLE "Category" DROP COLUMN "sortOrder";

-- 5. A track name now identifies a track globally.
CREATE UNIQUE INDEX "Category_nameFr_key" ON "Category"("nameFr");
