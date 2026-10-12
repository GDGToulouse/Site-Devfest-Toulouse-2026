-- The Sessionize service session a schedule entry came from (#546): breaks,
-- lunch, keynotes still without a speaker. The import updates and removes only
-- the entries it created, found by this id; null is an entry typed by hand,
-- which the import never touches.

ALTER TABLE "ScheduleEntry" ADD COLUMN "sessionizeId" TEXT;

CREATE UNIQUE INDEX "ScheduleEntry_editionId_sessionizeId_key" ON "ScheduleEntry"("editionId", "sessionizeId");
