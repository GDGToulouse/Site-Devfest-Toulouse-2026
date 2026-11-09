-- A note on a contact scanned at the booth (#815), its last change and author.
ALTER TABLE "SponsorScan" ADD COLUMN "note" TEXT;
ALTER TABLE "SponsorScan" ADD COLUMN "noteUpdatedAt" TIMESTAMP(3);
ALTER TABLE "SponsorScan" ADD COLUMN "noteUpdatedByLabel" TEXT;
