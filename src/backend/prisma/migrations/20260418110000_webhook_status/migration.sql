-- Track the outcome of the contact_webhook_url POST per message so the
-- admin can see failures and retry them.
ALTER TABLE "ContactMessage"
  ADD COLUMN "webhookStatus" TEXT NOT NULL DEFAULT 'not_attempted',
  ADD COLUMN "webhookAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "webhookError" TEXT;
