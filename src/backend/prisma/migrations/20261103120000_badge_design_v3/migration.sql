-- AlterEnum
ALTER TYPE "BadgeType" ADD VALUE 'STAFF';
ALTER TYPE "BadgeType" ADD VALUE 'SPONSOR';

-- Bins and ranks now count from 1 (#774): at most 9 bins per counter and 99
-- badges per bin. Clamp what is stored; nothing is numbered before the freeze.
UPDATE "Edition" SET "badgeBinsPerCounter" = LEAST("badgeBinsPerCounter", 9), "badgesPerBin" = LEAST("badgesPerBin", 99);
ALTER TABLE "Edition" ALTER COLUMN "badgesPerBin" SET DEFAULT 99;
