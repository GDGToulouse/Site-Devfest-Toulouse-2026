-- Sponsor accounts that accepted their invitation prove their mailbox (#514).
--
-- better-auth 1.7 clears the password and linked accounts of an account whose
-- email is not verified, on its first magic-link sign-in. Sponsors signed up by
-- password through an invitation were left unverified, although the invitation
-- token had been mailed to that very address and acceptance requires the
-- account's email to match it. The accept route now sets the flag; this sets it
-- on the accounts that accepted before.
UPDATE "user" u
SET "emailVerified" = true
WHERE u."emailVerified" = false
  AND EXISTS (
    SELECT 1
    FROM "SponsorContact" c
    WHERE c."userId" = u."id"
      AND c."invitationAcceptedAt" IS NOT NULL
      AND lower(c."email") = lower(u."email")
  );
