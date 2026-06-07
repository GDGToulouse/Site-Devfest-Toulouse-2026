-- Hide certain ContactCategory entries from the public /contact <select>
-- while keeping them usable via forceCategoryId on dedicated pages.
ALTER TABLE "ContactCategory"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT TRUE;
