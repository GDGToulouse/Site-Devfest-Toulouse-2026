-- Badges a sponsor's booth scanned (#813): the code read, by whom, when.
CREATE TABLE "SponsorScan" (
    "id" SERIAL NOT NULL,
    "editionId" INTEGER NOT NULL,
    "sponsorId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "scannedByLabel" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorScan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SponsorScan_editionId_sponsorId_code_key" ON "SponsorScan"("editionId", "sponsorId", "code");
CREATE INDEX "SponsorScan_editionId_idx" ON "SponsorScan"("editionId");

ALTER TABLE "SponsorScan" ADD CONSTRAINT "SponsorScan_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsorScan" ADD CONSTRAINT "SponsorScan_sponsorId_fkey"
  FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
