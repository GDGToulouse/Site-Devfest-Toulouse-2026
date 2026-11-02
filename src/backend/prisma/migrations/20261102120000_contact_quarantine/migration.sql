-- #767: a contact message that looks like phishing is stored but nothing is
-- sent until an organizer releases it. The score and its reasons stay on the
-- row, released or not, to tune the rules on real false positives.
ALTER TABLE "ContactMessage"
  ADD COLUMN "quarantinedAt" TIMESTAMP(3),
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "spamScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "spamReasons" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "ContactMessage_quarantinedAt_idx" ON "ContactMessage"("quarantinedAt");
