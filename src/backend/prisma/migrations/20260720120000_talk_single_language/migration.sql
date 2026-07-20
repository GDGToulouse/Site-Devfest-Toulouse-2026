-- Talk becomes single-language (#293): a talk is given in one language, already
-- carried by Talk.language. Merge the four bilingual columns into two.
--
-- DESTRUCTIVE: the copy below MUST run before the drops. The retained version is
-- the one matching Talk.language, falling back to the other when it is empty so
-- no content is lost — in practice every imported talk had titleEn == titleFr.
--
-- `slug` is deliberately left untouched: it was derived from titleFr and is a
-- public, indexed URL. An English talk keeps its French-derived slug rather than
-- breaking the link.

ALTER TABLE "Talk" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Talk" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

UPDATE "Talk" SET
  "title" = CASE
    WHEN "language" = 'en' AND "titleEn" <> '' THEN "titleEn"
    WHEN "titleFr" <> '' THEN "titleFr"
    ELSE "titleEn"
  END,
  "description" = CASE
    WHEN "language" = 'en' AND "descriptionEn" <> '' THEN "descriptionEn"
    WHEN "descriptionFr" <> '' THEN "descriptionFr"
    ELSE "descriptionEn"
  END;

ALTER TABLE "Talk" DROP COLUMN "titleFr";
ALTER TABLE "Talk" DROP COLUMN "titleEn";
ALTER TABLE "Talk" DROP COLUMN "descriptionFr";
ALTER TABLE "Talk" DROP COLUMN "descriptionEn";

-- The default only existed to backfill existing rows; new rows must supply both.
ALTER TABLE "Talk" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE "Talk" ALTER COLUMN "description" DROP DEFAULT;
