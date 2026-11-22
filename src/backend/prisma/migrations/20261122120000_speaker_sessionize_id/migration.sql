-- The speaker's id in Sessionize (#866), set by the API import and by the
-- import of the organizers' Excel export.

-- AlterTable
ALTER TABLE "Speaker" ADD COLUMN "sessionizeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Speaker_sessionizeId_key" ON "Speaker"("sessionizeId");
