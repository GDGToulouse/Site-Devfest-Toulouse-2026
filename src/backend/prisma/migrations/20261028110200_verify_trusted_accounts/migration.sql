-- #673: better-auth now requires a verified address to sign in with a password
-- (emailAndPassword.requireEmailVerification). Accounts whose mailbox the site
-- already trusts are marked verified, so they keep their password:
--
-- * ADMIN: granted only by the seed (ADMIN_EMAILS) or by another admin. The
--   seed's fallback path used to create them unverified.
-- * SPONSOR bound to a contact whose invitation was accepted: the invitation
--   token was mailed to that address. Acceptance has set emailVerified since
--   #514; accounts accepted before that are caught here.
--
-- Anything else left unverified signs in by magic link, which verifies it.

UPDATE "user" u
SET "emailVerified" = true
WHERE u."emailVerified" = false
  AND (
    u."role" = 'ADMIN'
    OR (
      u."role" = 'SPONSOR'
      AND EXISTS (
        SELECT 1 FROM "SponsorContact" c
        WHERE c."userId" = u."id" AND c."invitationAcceptedAt" IS NOT NULL
      )
    )
  );
