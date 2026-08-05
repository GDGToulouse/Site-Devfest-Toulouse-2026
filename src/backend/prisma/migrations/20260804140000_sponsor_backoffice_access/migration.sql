-- Sponsor back-office access (#362).
--
-- A sponsor gets a real account instead of an edit-by-token link. Three things
-- are needed before any of that can work: a per-sponsor permission, a link from
-- the contact to the account behind it, and an invitation distinct from the
-- existing edit token.

-- 1. What a person may do on ONE sponsor's space. Not part of UserRole, which
--    grants back-office access — a sponsor must never hold that.
CREATE TYPE "SponsorAccessRole" AS ENUM ('RESPONSABLE', 'EDITEUR', 'STAND');

-- 2. A neutral back-office role for sponsor accounts.
--
--    User.role defaults to EDITOR, and requireAnyAuthenticated lets EDITOR
--    through: without this value, creating a sponsor account would hand it the
--    back-office. SPONSOR grants nothing there; rights live on SponsorContact.
ALTER TYPE "UserRole" ADD VALUE 'SPONSOR';

-- 3. Per-contact access and the account behind it.
--
--    EDITEUR as the default is what existing rows already were: every contact
--    edited the same page with equal rights (#250), which is exactly EDITEUR.
--    Nobody is promoted or demoted by this migration.
ALTER TABLE "SponsorContact"
  ADD COLUMN "accessRole" "SponsorAccessRole" NOT NULL DEFAULT 'EDITEUR',
  ADD COLUMN "userId" TEXT,
  -- Kept apart from editToken: 7 days vs 30, single-use vs not, and the edit
  -- link stays in service for speakers. One column could not carry both.
  ADD COLUMN "invitationToken" TEXT,
  ADD COLUMN "invitationSentAt" TIMESTAMP(3),
  ADD COLUMN "invitationAcceptedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SponsorContact_invitationToken_key" ON "SponsorContact"("invitationToken");
CREATE INDEX "SponsorContact_userId_idx" ON "SponsorContact"("userId");

-- SetNull, not Cascade: deleting an account must not erase the sponsor's
-- contact list — the organisers still need the address they wrote to.
ALTER TABLE "SponsorContact"
  ADD CONSTRAINT "SponsorContact_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
