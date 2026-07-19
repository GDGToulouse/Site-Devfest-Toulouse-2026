-- Multi-contact modification links for sponsors (#250).
-- Replaces the single editToken on Sponsor with a SponsorContact table:
-- several people per sponsor, each with their own token / lock / send date.
-- Order matters: create the table and MIGRATE existing tokens into it BEFORE
-- dropping the columns, so no live modification link is lost.

-- 1. New table
CREATE TABLE "SponsorContact" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "editToken" TEXT,
    "editLinkLocked" BOOLEAN NOT NULL DEFAULT false,
    "editTokenSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sponsorId" INTEGER NOT NULL,
    CONSTRAINT "SponsorContact_pkey" PRIMARY KEY ("id")
);

-- 2. Carry over every sponsor that already has a modification link, as its
--    first contact. Sponsors with a token but no contactEmail get a synthetic
--    placeholder so the NOT NULL email holds; the admin can fix it later.
-- name is left NULL: Sponsor.name is the company, not the person behind the
-- link, and we don't know the latter for pre-existing tokens.
INSERT INTO "SponsorContact" ("email", "editToken", "editLinkLocked", "editTokenSentAt", "createdAt", "updatedAt", "sponsorId")
SELECT
    COALESCE(NULLIF(TRIM("contactEmail"), ''), 'contact-' || "id" || '@import.local'),
    "editToken",
    "editLinkLocked",
    "editTokenSentAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "id"
FROM "Sponsor"
WHERE "editToken" IS NOT NULL;

-- 3. Indexes and FK
CREATE UNIQUE INDEX "SponsorContact_editToken_key" ON "SponsorContact"("editToken");
CREATE INDEX "SponsorContact_sponsorId_idx" ON "SponsorContact"("sponsorId");
ALTER TABLE "SponsorContact" ADD CONSTRAINT "SponsorContact_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Now that the tokens live in SponsorContact, drop them from Sponsor.
DROP INDEX "Sponsor_editToken_key";
ALTER TABLE "Sponsor" DROP COLUMN "editLinkLocked",
DROP COLUMN "editToken",
DROP COLUMN "editTokenSentAt";
