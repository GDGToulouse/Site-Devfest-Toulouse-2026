-- Sponsor guest registration (#727): places per edition offer, adjustments per
-- participation, the guests themselves, and the edition's opening, deadline and
-- Billetweb target (#731). Registration starts closed on every edition.

-- CreateEnum
CREATE TYPE "SponsorGuestGender" AS ENUM ('FEMALE', 'MALE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "SponsorGuestExperience" AS ENUM ('STUDENT', 'UNDER_3_YEARS', 'FROM_3_TO_7_YEARS', 'OVER_7_YEARS');

-- CreateEnum
CREATE TYPE "SponsorGuestDiet" AS ENUM ('NONE', 'VEGETARIAN', 'VEGAN', 'OTHER');

-- CreateEnum
CREATE TYPE "SponsorGuestAdjustmentReason" AS ENUM ('PURCHASED', 'GOODWILL', 'CORRECTION');

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN "isSponsorGuestRegistrationOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sponsorGuestRegistrationOpenedAt" TIMESTAMP(3),
ADD COLUMN "sponsorGuestDeadline" TIMESTAMP(3),
ADD COLUMN "sponsorGuestBilletwebEventId" TEXT,
ADD COLUMN "sponsorGuestBilletwebTicketId" TEXT,
ADD COLUMN "sponsorGuestBilletwebTicketName" TEXT;

-- AlterTable
ALTER TABLE "EditionSponsorTier" ADD COLUMN "guestPlaces" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SponsorGuest" (
    "id" SERIAL NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "gender" "SponsorGuestGender" NOT NULL,
    "experience" "SponsorGuestExperience" NOT NULL,
    "attendsAfterParty" BOOLEAN NOT NULL DEFAULT false,
    "diet" "SponsorGuestDiet" NOT NULL DEFAULT 'NONE',
    "needsAssistance" BOOLEAN NOT NULL DEFAULT false,
    "billetwebOrderId" TEXT,
    "billetwebTicketId" TEXT,
    "billetwebSyncedAt" TIMESTAMP(3),
    "billetwebError" TEXT,
    "isBilletwebCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionSponsorId" INTEGER NOT NULL,

    CONSTRAINT "SponsorGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorGuestAdjustment" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "SponsorGuestAdjustmentReason" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editionSponsorId" INTEGER NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "SponsorGuestAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SponsorGuest_billetwebTicketId_key" ON "SponsorGuest"("billetwebTicketId");

-- CreateIndex
CREATE INDEX "SponsorGuest_editionSponsorId_createdAt_idx" ON "SponsorGuest"("editionSponsorId", "createdAt");

-- CreateIndex
CREATE INDEX "SponsorGuestAdjustment_editionSponsorId_idx" ON "SponsorGuestAdjustment"("editionSponsorId");

-- AddForeignKey
ALTER TABLE "SponsorGuest" ADD CONSTRAINT "SponsorGuest_editionSponsorId_fkey" FOREIGN KEY ("editionSponsorId") REFERENCES "EditionSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorGuestAdjustment" ADD CONSTRAINT "SponsorGuestAdjustment_editionSponsorId_fkey" FOREIGN KEY ("editionSponsorId") REFERENCES "EditionSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorGuestAdjustment" ADD CONSTRAINT "SponsorGuestAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
