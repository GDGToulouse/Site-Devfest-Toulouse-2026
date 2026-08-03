-- Sponsor becomes a global identity (#129).
--
-- Sponsor carried a mandatory editionId and a per-edition unique slug, so a
-- company sponsoring several editions would exist as several unlinked rows.
-- Sponsor becomes the company, EditionSponsor carries the participation and
-- everything bought or tracked for that year -- the same split as
-- SpeakerEdition (#351), EditionCategory (#338) and EditionSponsorTier (#316).
--
-- NOT destructive in the #351 sense: no sponsor exists on more than one
-- edition today, so there is nothing to fold and no row is deleted. Every
-- Sponsor produces exactly one EditionSponsor.
--
-- Invariants to check on both sides:
--   SELECT count(*) FROM "Sponsor";           -- unchanged
--   SELECT count(*) FROM "EditionSponsor";    -- equals the above
--   SELECT count(*) FROM "SponsorJobOffer";   -- unchanged
--   SELECT count(*) FROM "SponsorContact";    -- unchanged

-- ---------------------------------------------------------------------------
-- 0. GUARD. Step 5 creates a global unique index on Sponsor.slug. If two
--    editions ever shared a slug, that index would fail with a violation that
--    says nothing useful. Fail here instead, naming the problem.
--
--    This cannot happen with today's data (every sponsor is on one edition).
--    It is checked rather than assumed: the #351 migration's hardest bug came
--    from a cascade nobody had verified.
--
--    Scope: the guard reads the stored slug, so trashed rows are invisible to
--    it — the trash parks them as "__trash_<id>__<slug>" (#146). That is
--    deliberate, not an oversight: a parked slug cannot collide with the new
--    index either, and if two trashed sponsors from different editions did
--    share an original slug, restoring the second already answers 409
--    restore_conflict (routes/admin/trash.ts). Nothing is lost, and the admin
--    is told. There are 0 trashed sponsors at migration time.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count INTEGER;
  dup_list  TEXT;
BEGIN
  SELECT count(*), string_agg(slug, ', ')
  INTO dup_count, dup_list
  FROM (SELECT "slug" FROM "Sponsor" GROUP BY "slug" HAVING count(*) > 1) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot make Sponsor.slug globally unique: % slug(s) used by more than one sponsor (%). Merge them before migrating.',
      dup_count, dup_list;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. The join table.
-- ---------------------------------------------------------------------------
CREATE TABLE "EditionSponsor" (
  "id" SERIAL PRIMARY KEY,
  "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sponsorId" INTEGER NOT NULL,
  "editionId" INTEGER NOT NULL,
  "tierId" INTEGER NOT NULL,
  "comKitReceived" BOOLEAN NOT NULL DEFAULT false,
  "comKitLogoWebUrl" TEXT,
  "comKitLogoPrintUrl" TEXT,
  "comKitCharterUrl" TEXT,
  "comKitNotes" TEXT,
  "platinumPromoIdea" TEXT,
  "platinumCoBuildIdea" TEXT,
  -- What the edition displayed, frozen so later edits never rewrite an
  -- archive (#375). Nullable: null reads through to the live tier / identity.
  "logoUrl" TEXT,
  "tierNameFr" TEXT,
  "tierNameEn" TEXT,
  "tierColor" TEXT,
  "tierLogoScale" DOUBLE PRECISION
);

CREATE UNIQUE INDEX "EditionSponsor_sponsorId_editionId_key" ON "EditionSponsor"("sponsorId", "editionId");
CREATE INDEX "EditionSponsor_sponsorId_idx" ON "EditionSponsor"("sponsorId");
CREATE INDEX "EditionSponsor_editionId_idx" ON "EditionSponsor"("editionId");
CREATE INDEX "EditionSponsor_tierId_idx" ON "EditionSponsor"("tierId");

ALTER TABLE "EditionSponsor"
  ADD CONSTRAINT "EditionSponsor_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionSponsor"
  ADD CONSTRAINT "EditionSponsor_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionSponsor"
  ADD CONSTRAINT "EditionSponsor_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SponsorTier"("id") ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. One participation per existing sponsor, carrying the per-edition state.
--    Trashed sponsors included: the trash lives on the identity, and restoring
--    one must restore a company that still belongs to its edition.
-- ---------------------------------------------------------------------------
--    The logo and the tier's appearance are frozen here (#375): the split
--    moves logoUrl onto the identity, which would otherwise let a 2027 logo
--    change repaint 2026's wall. Sponsor.logoUrl stays as the company's
--    current logo and the fallback for a participation that has none.
--
--    The JOIN cannot drop a sponsor: Sponsor.tierId is NOT NULL behind
--    Sponsor_tierId_fkey (ON DELETE RESTRICT, 20260723084347), so every row
--    has a live tier. Step 3's SET NOT NULL would catch it anyway.
INSERT INTO "EditionSponsor" (
  "sponsorId", "editionId", "tierId", "publicationStatus",
  "comKitReceived", "comKitLogoWebUrl", "comKitLogoPrintUrl",
  "comKitCharterUrl", "comKitNotes", "platinumPromoIdea",
  "platinumCoBuildIdea", "updatedAt",
  "logoUrl", "tierNameFr", "tierNameEn", "tierColor", "tierLogoScale"
)
SELECT
  s."id", s."editionId", s."tierId", s."publicationStatus",
  s."comKitReceived", s."comKitLogoWebUrl", s."comKitLogoPrintUrl",
  s."comKitCharterUrl", s."comKitNotes", s."platinumPromoIdea",
  s."platinumCoBuildIdea", CURRENT_TIMESTAMP,
  s."logoUrl", t."nameFr", t."nameEn", t."color", t."logoScale"
FROM "Sponsor" s
JOIN "SponsorTier" t ON t."id" = s."tierId";

-- ---------------------------------------------------------------------------
-- 3. Job offers hang off the participation. The column is added nullable,
--    backfilled, then made NOT NULL -- an offer with no participation would
--    mean step 2 missed a sponsor, so the SET NOT NULL is the check.
-- ---------------------------------------------------------------------------
ALTER TABLE "SponsorJobOffer" ADD COLUMN "editionSponsorId" INTEGER;

UPDATE "SponsorJobOffer" o
SET "editionSponsorId" = es."id"
FROM "EditionSponsor" es
WHERE es."sponsorId" = o."sponsorId";

ALTER TABLE "SponsorJobOffer" ALTER COLUMN "editionSponsorId" SET NOT NULL;

ALTER TABLE "SponsorJobOffer" DROP CONSTRAINT IF EXISTS "SponsorJobOffer_sponsorId_fkey";
DROP INDEX IF EXISTS "SponsorJobOffer_sponsorId_idx";
ALTER TABLE "SponsorJobOffer" DROP COLUMN "sponsorId";

CREATE INDEX "SponsorJobOffer_editionSponsorId_idx" ON "SponsorJobOffer"("editionSponsorId");
ALTER TABLE "SponsorJobOffer"
  ADD CONSTRAINT "SponsorJobOffer_editionSponsorId_fkey" FOREIGN KEY ("editionSponsorId") REFERENCES "EditionSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. The edition link and the per-edition fields now live on the join.
--    Index names taken from the live schema, not guessed.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "Sponsor_editionId_idx";
DROP INDEX IF EXISTS "Sponsor_tierId_idx";
DROP INDEX IF EXISTS "Sponsor_editionId_slug_key";
ALTER TABLE "Sponsor" DROP CONSTRAINT IF EXISTS "Sponsor_editionId_fkey";
ALTER TABLE "Sponsor" DROP CONSTRAINT IF EXISTS "Sponsor_tierId_fkey";
ALTER TABLE "Sponsor" DROP COLUMN "editionId";
ALTER TABLE "Sponsor" DROP COLUMN "tierId";
ALTER TABLE "Sponsor" DROP COLUMN "publicationStatus";
ALTER TABLE "Sponsor" DROP COLUMN "comKitReceived";
ALTER TABLE "Sponsor" DROP COLUMN "comKitLogoWebUrl";
ALTER TABLE "Sponsor" DROP COLUMN "comKitLogoPrintUrl";
ALTER TABLE "Sponsor" DROP COLUMN "comKitCharterUrl";
ALTER TABLE "Sponsor" DROP COLUMN "comKitNotes";
ALTER TABLE "Sponsor" DROP COLUMN "platinumPromoIdea";
ALTER TABLE "Sponsor" DROP COLUMN "platinumCoBuildIdea";

-- ---------------------------------------------------------------------------
-- 5. A slug now identifies a company globally.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Sponsor_slug_key" ON "Sponsor"("slug");
