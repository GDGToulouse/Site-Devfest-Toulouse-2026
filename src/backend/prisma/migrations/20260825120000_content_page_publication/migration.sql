-- Publication state and trash for content pages (#419).
--
-- `ContentPage` was a content store for two hardcoded routes (code of conduct,
-- legal notice) until the `[locale]/[slug]` segment opened every row to the
-- public (#421). The publication filter that was meant to ship with that route
-- never did, so a page created from the admin went live the moment it was
-- saved — and, with no DELETE route, could not be taken down again.

ALTER TABLE "ContentPage" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentPage" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Every existing row is already reachable in production — the two hardcoded
-- routes serve theirs, and the ones created since #421 answer on /[slug].
-- Leaving them at the column default would take live pages down, so they are
-- backfilled as published; only rows created from now on start as drafts.
UPDATE "ContentPage" SET "isPublished" = true;

CREATE INDEX "ContentPage_deletedAt_idx" ON "ContentPage"("deletedAt");
