-- AlterTable
ALTER TABLE "Attendee" ADD COLUMN "checkInError" TEXT,
ADD COLUMN "checkedInAt" TIMESTAMP(3),
ADD COLUMN "scannedAt" TIMESTAMP(3),
ADD COLUMN "scannedByLabel" TEXT;
