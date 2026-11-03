-- Hash the speaker edit links and sponsor invitations already sent (#672).
-- From now on the database keeps only the SHA-256 of these tokens, in lowercase
-- hex, and the application hashes the token from the URL before looking it up
-- (hashLinkToken in src/lib/edit-token.ts). Hashing the stored values in place
-- keeps every mailed link working. sha256() is built into Postgres since 11: no
-- pgcrypto needed. Columns keep their names and their unique index: SHA-256
-- does not collide, and the hashes stay 64 characters like the tokens.

UPDATE "Speaker"
SET "editToken" = encode(sha256(convert_to("editToken", 'UTF8')), 'hex')
WHERE "editToken" IS NOT NULL;

UPDATE "SponsorContact"
SET "invitationToken" = encode(sha256(convert_to("invitationToken", 'UTF8')), 'hex')
WHERE "invitationToken" IS NOT NULL;
