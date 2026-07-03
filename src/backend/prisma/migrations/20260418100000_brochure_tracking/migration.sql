-- Track per-message brochure downloads (Option A from the plan):
-- the public /api/brochure/:token redirector increments these.
ALTER TABLE "ContactMessage"
  ADD COLUMN "brochureDownloadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "brochureDownloadedAt" TIMESTAMP(3);
