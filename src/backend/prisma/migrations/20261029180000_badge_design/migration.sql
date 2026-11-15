-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('PARTICIPANT', 'SPEAKER', 'VOLUNTEER', 'CONTRACTOR');

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN "badgesPerBin" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "badgeDesign" JSONB;

-- AlterTable
ALTER TABLE "TicketTier" ADD COLUMN "badgeType" "BadgeType";
