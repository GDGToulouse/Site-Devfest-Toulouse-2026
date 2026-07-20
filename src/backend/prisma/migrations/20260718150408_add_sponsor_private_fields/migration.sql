-- AlterTable
ALTER TABLE "Sponsor" ADD COLUMN     "comKitCharterUrl" TEXT,
ADD COLUMN     "comKitLogoPrintUrl" TEXT,
ADD COLUMN     "comKitLogoWebUrl" TEXT,
ADD COLUMN     "comKitNotes" TEXT,
ADD COLUMN     "comKitReceived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "standContacts" TEXT;
