-- The sponsor modification link was replaced by an account (#362), and the
-- links still in mailboxes only converted into invitations. Nothing has written
-- these columns since #362 reached production on 2026-08-20: past the 30-day
-- window, they carry no live link (#404).

DROP INDEX IF EXISTS "SponsorContact_editToken_key";

ALTER TABLE "SponsorContact"
  DROP COLUMN "editToken",
  DROP COLUMN "editLinkLocked",
  DROP COLUMN "editTokenSentAt";
