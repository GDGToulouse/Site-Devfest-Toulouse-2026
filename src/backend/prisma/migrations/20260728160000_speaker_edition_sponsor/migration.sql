-- #353 — the sponsor association moves from Speaker to SpeakerEdition.
--
-- Working for a sponsor is true of a given year, and Sponsor is itself
-- edition-scoped (editionId + @@unique([editionId, slug])). A global speaker
-- pointing at a dated sponsor row could only ever show one employer, so a person
-- at Google in 2019 and OVHcloud in 2026 displayed the wrong one on one of them.

-- 1. The column on the participation.
ALTER TABLE "SpeakerEdition" ADD COLUMN "sponsorId" INTEGER;

-- 2. Backfill onto the participation of the SPONSOR'S OWN edition — not the most
--    recent one. Putting a 2019 sponsor on a 2026 participation would recreate
--    the very mismatch this migration removes. A speaker linked to a sponsor of
--    an edition they never took part in therefore keeps no link: there is no
--    year where the statement would be true.
UPDATE "SpeakerEdition" se
SET "sponsorId" = s."sponsorId"
FROM "Speaker" s, "Sponsor" sp
WHERE se."speakerId" = s."id"
  AND s."sponsorId" = sp."id"
  AND se."editionId" = sp."editionId";

-- 3. Same delete behaviour as before: removing a sponsor clears the association
--    instead of taking the participation down with it.
ALTER TABLE "SpeakerEdition"
  ADD CONSTRAINT "SpeakerEdition_sponsorId_fkey"
  FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SpeakerEdition_sponsorId_idx" ON "SpeakerEdition"("sponsorId");

-- 4. Drop the old column. Its FK and index go with it.
DROP INDEX IF EXISTS "Speaker_sponsorId_idx";
ALTER TABLE "Speaker" DROP CONSTRAINT IF EXISTS "Speaker_sponsorId_fkey";
ALTER TABLE "Speaker" DROP COLUMN "sponsorId";
