-- Station links without an account (#775): the validity window of the QR codes
-- (null = derived from the edition dates) and the generation they derive from.
ALTER TABLE "Edition" ADD COLUMN "stationAccessFrom" TIMESTAMP(3),
  ADD COLUMN "stationAccessUntil" TIMESTAMP(3),
  ADD COLUMN "stationAccessGeneration" INTEGER NOT NULL DEFAULT 1;
