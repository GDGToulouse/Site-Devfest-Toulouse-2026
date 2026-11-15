-- AlterTable
ALTER TABLE "Edition" ADD COLUMN     "badgeBinsPerCounter" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "badgeCounters" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "badgesFrozenAt" TIMESTAMP(3),
ADD COLUMN     "billetwebBadgeFieldId" TEXT;

-- AlterTable
ALTER TABLE "Attendee" ADD COLUMN     "badgeNumber" INTEGER,
ADD COLUMN     "badgeWriteError" TEXT,
ADD COLUMN     "badgeWrittenAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_editionId_badgeNumber_key" ON "Attendee"("editionId", "badgeNumber");
