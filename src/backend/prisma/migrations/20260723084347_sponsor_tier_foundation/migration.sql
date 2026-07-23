-- Sponsoring refactor foundation (#316/#317): unify the frozen SponsorLevel enum
-- and the per-edition SponsorPlan model into one durable, editable catalogue.
--
--   SponsorTier         — global catalogue (one row = one complete offer)
--   EditionSponsorTier  — which tiers an edition proposes (price/visibility/order)
--   Sponsor.level       — enum → FK Sponsor.tierId
--
-- DESTRUCTIVE at the end: the backfill (steps 5-6) MUST run before the drops
-- (step 8). The four canonical tiers are created first, existing sponsors are
-- remapped from their old enum level, then the SponsorPlan rows are folded into
-- the per-edition join. Only then are the old column/table/type dropped.
--
-- Enum → tier mapping (epic #316, absorbs #315's 4-tier redesign):
--   PLATINUM → platinum, GOLD → gold, SILVER → discovery,
--   SOUTIEN / COMMUNAUTE → soutien-communautes.

-- 1. Global catalogue.
CREATE TABLE "SponsorTier" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "nameFr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "subtitleFr" TEXT,
  "subtitleEn" TEXT,
  "descriptionFr" TEXT,
  "descriptionEn" TEXT,
  "advantages" TEXT,
  "standSize" TEXT,
  "color" TEXT NOT NULL DEFAULT '#109E6E',
  "logoScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "jobOfferQuota" INTEGER NOT NULL DEFAULT 1,
  "allowsPromoIdeas" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "SponsorTier_key_key" ON "SponsorTier"("key");
CREATE INDEX "SponsorTier_deletedAt_idx" ON "SponsorTier"("deletedAt");

-- 2. Tier ↔ Edition join (replaces Edition.openSponsorLevels + SponsorPlan role).
CREATE TABLE "EditionSponsorTier" (
  "id" SERIAL PRIMARY KEY,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "price" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "editionId" INTEGER NOT NULL,
  "tierId" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "EditionSponsorTier_editionId_tierId_key" ON "EditionSponsorTier"("editionId", "tierId");
CREATE INDEX "EditionSponsorTier_editionId_idx" ON "EditionSponsorTier"("editionId");
CREATE INDEX "EditionSponsorTier_tierId_idx" ON "EditionSponsorTier"("tierId");
ALTER TABLE "EditionSponsorTier"
  ADD CONSTRAINT "EditionSponsorTier_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionSponsorTier"
  ADD CONSTRAINT "EditionSponsorTier_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SponsorTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. The four canonical tiers. rank decreasing, logoScale decreasing, quota per
-- tier (ex-OFFER_QUOTA), allowsPromoIdeas only for Platinum. Colours taken from
-- the frontend LEVEL_BANNER (emerald/yellow/pink) plus blue for the 4th.
INSERT INTO "SponsorTier"
  ("key", "nameFr", "nameEn", "color", "logoScale", "rank", "jobOfferQuota", "allowsPromoIdeas", "updatedAt")
VALUES
  ('platinum',            'Platinum',               'Platinum',            '#109E6E', 1.0, 40, 4, true,  CURRENT_TIMESTAMP),
  ('gold',                'Gold',                   'Gold',                '#FFD428', 0.8, 30, 2, false, CURRENT_TIMESTAMP),
  ('discovery',           'Discovery',              'Discovery',           '#EE7CAD', 0.6, 20, 1, false, CURRENT_TIMESTAMP),
  ('soutien-communautes', 'Soutien et Communautés', 'Support & Communities','#507BBD', 0.5, 10, 1, false, CURRENT_TIMESTAMP);

-- 4. Sponsor.tierId — nullable first so existing rows can be backfilled.
ALTER TABLE "Sponsor" ADD COLUMN "tierId" INTEGER;

-- 5. Remap existing sponsors from the old enum level.
UPDATE "Sponsor" SET "tierId" = (SELECT "id" FROM "SponsorTier" WHERE "key" = 'platinum')            WHERE "level" = 'PLATINUM';
UPDATE "Sponsor" SET "tierId" = (SELECT "id" FROM "SponsorTier" WHERE "key" = 'gold')                 WHERE "level" = 'GOLD';
UPDATE "Sponsor" SET "tierId" = (SELECT "id" FROM "SponsorTier" WHERE "key" = 'discovery')            WHERE "level" = 'SILVER';
UPDATE "Sponsor" SET "tierId" = (SELECT "id" FROM "SponsorTier" WHERE "key" = 'soutien-communautes')  WHERE "level" IN ('SOUTIEN', 'COMMUNAUTE');
-- Safety net: any sponsor left unmapped falls back to the lowest tier so the
-- NOT NULL lock (step 7) cannot fail.
UPDATE "Sponsor" SET "tierId" = (SELECT "id" FROM "SponsorTier" WHERE "key" = 'soutien-communautes')  WHERE "tierId" IS NULL;

-- 6. Fold existing SponsorPlan rows into the per-edition join. Match a plan to a
-- catalogue tier by its French name; price/isVisible/sortOrder carry over. The
-- plan's own advantages/color/standSize are NOT copied onto the shared catalogue
-- (the tiers already hold canonical values; editorial refinement is #318).
INSERT INTO "EditionSponsorTier" ("editionId", "tierId", "isVisible", "price", "sortOrder", "updatedAt")
SELECT
  sp."editionId",
  t."id",
  sp."isVisible",
  sp."price",
  sp."sortOrder",
  CURRENT_TIMESTAMP
FROM "SponsorPlan" sp
JOIN "SponsorTier" t ON t."key" = CASE
  WHEN lower(sp."nameFr") LIKE 'platinum%'  THEN 'platinum'
  WHEN lower(sp."nameFr") LIKE 'gold%'      THEN 'gold'
  WHEN lower(sp."nameFr") LIKE 'discovery%' THEN 'discovery'
  ELSE 'soutien-communautes'
END
WHERE sp."deletedAt" IS NULL
ON CONFLICT ("editionId", "tierId") DO NOTHING;

-- 7. Lock the FK now that every sponsor has a tier.
ALTER TABLE "Sponsor" ALTER COLUMN "tierId" SET NOT NULL;
ALTER TABLE "Sponsor"
  ADD CONSTRAINT "Sponsor_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SponsorTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Sponsor_tierId_idx" ON "Sponsor"("tierId");

-- 8. DESTRUCTIVE — drop the old model, only after the backfill above.
ALTER TABLE "Sponsor" DROP COLUMN "level";
ALTER TABLE "Edition" DROP COLUMN "openSponsorLevels";
DROP TABLE "SponsorPlan";
DROP TYPE "SponsorLevel";
