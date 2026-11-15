-- The place in a bin counts from 00 (#774): a bin holds 100 badges again.
-- Give back the 100th place to the editions the previous migration clamped to
-- 99, unless they are frozen: a frozen numbering is never touched here, it is
-- reset and frozen again from the admin.
UPDATE "Edition" SET "badgesPerBin" = 100 WHERE "badgesPerBin" = 99 AND "badgesFrozenAt" IS NULL;
ALTER TABLE "Edition" ALTER COLUMN "badgesPerBin" SET DEFAULT 100;
