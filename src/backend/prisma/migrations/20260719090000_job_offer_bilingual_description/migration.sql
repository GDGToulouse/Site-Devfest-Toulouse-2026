-- Make the job offer description bilingual (#273). Order matters: add the new
-- columns, copy the existing single description into the French one (no data
-- loss), then drop the old column.

-- Add the two localized columns (empty default so existing rows are valid).
ALTER TABLE "SponsorJobOffer" ADD COLUMN "descriptionFr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SponsorJobOffer" ADD COLUMN "descriptionEn" TEXT NOT NULL DEFAULT '';

-- Preserve what's already there: the previous single description was French.
UPDATE "SponsorJobOffer" SET "descriptionFr" = "description";

-- Drop the now-replaced column.
ALTER TABLE "SponsorJobOffer" DROP COLUMN "description";
