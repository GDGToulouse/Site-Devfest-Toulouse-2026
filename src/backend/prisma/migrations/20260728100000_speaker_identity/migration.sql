-- Speaker becomes a global identity (#351).
--
-- Speaker carried a mandatory editionId and a per-edition unique slug, so a
-- person who spoke at several editions existed as several unlinked rows: 330
-- rows for 240 people, 58 of them multi-edition. Speaker becomes the person,
-- SpeakerEdition carries the participation and the two per-edition editorial
-- fields — the same split as EditionSponsorTier (#316) and EditionCategory
-- (#338).
--
-- DESTRUCTIVE: 90 rows are deleted at step 6.
--
-- THE ORDER MATTERS. "_SpeakerToTalk"."A_fkey" is ON DELETE CASCADE, so
-- deleting an absorbed Speaker before repointing its talk links drops those
-- links WITHOUT RAISING ANYTHING. Step 5 must complete before step 6.
-- Invariant to check on both sides of this migration:
--   SELECT count(*) FROM "_SpeakerToTalk";  -- 289, unchanged
--
-- 31 speakers have no talk at all, so participations cannot be derived from
-- sessions. Step 2 reads Speaker.editionId row by row, before any fold.

-- ---------------------------------------------------------------------------
-- 1. Join table.
-- ---------------------------------------------------------------------------
CREATE TABLE "SpeakerEdition" (
  "id" SERIAL PRIMARY KEY,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "speakerId" INTEGER NOT NULL,
  "editionId" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "SpeakerEdition_speakerId_editionId_key" ON "SpeakerEdition"("speakerId", "editionId");
CREATE INDEX "SpeakerEdition_speakerId_idx" ON "SpeakerEdition"("speakerId");
CREATE INDEX "SpeakerEdition_editionId_idx" ON "SpeakerEdition"("editionId");
ALTER TABLE "SpeakerEdition"
  ADD CONSTRAINT "SpeakerEdition_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakerEdition"
  ADD CONSTRAINT "SpeakerEdition_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Carry every current (speaker, edition) pair into the join, with its
--    editorial state. Runs before any fold: this is the only place a
--    talk-less speaker's participation is recorded. Trashed rows included —
--    restoring one must restore a speaker that still belongs to its edition.
-- ---------------------------------------------------------------------------
INSERT INTO "SpeakerEdition" ("speakerId", "editionId", "isFeatured", "publicationStatus", "updatedAt")
SELECT s."id", s."editionId", s."isFeatured", s."publicationStatus", CURRENT_TIMESTAMP
FROM "Speaker" s
ON CONFLICT ("speakerId", "editionId") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Elect one survivor per slug: the row from the most recent edition, which
--    carries the freshest profile. Ties on year break on the highest id.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _speaker_survivor AS
SELECT DISTINCT ON (s."slug") s."slug", s."id" AS keep_id
FROM "Speaker" s
JOIN "Edition" e ON e."id" = s."editionId"
ORDER BY s."slug", e."year" DESC, s."id" DESC;

CREATE TEMP TABLE _speaker_loser AS
SELECT s."id" AS dup_id, v.keep_id
FROM "Speaker" s
JOIN _speaker_survivor v ON v."slug" = s."slug"
WHERE s."id" <> v.keep_id;

-- ---------------------------------------------------------------------------
-- 4. Fold the profile onto the survivor.
--
-- 4a. Name: prefer the accented, normally-cased spelling. Four slugs differ
--     only by accent or case — fabien-tregan (Tregan/Trégan),
--     francois-teychene, frederic-cabestre, jonathan-gaffiot (GAFFIOT) — and
--     there is no real homonym in the set, so a mechanical rule is safe:
--     accented beats unaccented, mixed case beats SHOUTED, then most recent.
--     translate() rather than unaccent(): the extension is not installed.
-- ---------------------------------------------------------------------------
UPDATE "Speaker" k
SET "name" = best."name"
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."name"
  FROM _speaker_survivor v
  JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  ORDER BY
    v.keep_id,
    (s."name" <> translate(s."name",
      'àáâãäçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
      'aaaaaceeeeiiiinooooouuuuyyAAAAACEEEEIIIINOOOOOUUUUY')) DESC,
    (s."name" = upper(s."name")) ASC,
    e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id;

-- 4b. Profile fields: keep the most recent edition that actually fills each
--     one. A newer NULL must not erase an older bio — the 2019 import has bios
--     the Sessionize years do not. One statement per field so each picks its
--     own "most recent non-empty"; written out rather than looped so the
--     migration stays readable and cannot be mangled by a statement splitter.
UPDATE "Speaker" k SET "photoUrl" = best.val
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."photoUrl" AS val
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."photoUrl" IS NOT NULL AND s."photoUrl" <> ''
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND (k."photoUrl" IS NULL OR k."photoUrl" = '');

UPDATE "Speaker" k SET "company" = best.val
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."company" AS val
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."company" IS NOT NULL AND s."company" <> ''
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND (k."company" IS NULL OR k."company" = '');

UPDATE "Speaker" k SET "city" = best.val
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."city" AS val
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."city" IS NOT NULL AND s."city" <> ''
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND (k."city" IS NULL OR k."city" = '');

UPDATE "Speaker" k SET "bioFr" = best.val
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."bioFr" AS val
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."bioFr" IS NOT NULL AND s."bioFr" <> ''
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND (k."bioFr" IS NULL OR k."bioFr" = '');

UPDATE "Speaker" k SET "bioEn" = best.val
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."bioEn" AS val
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."bioEn" IS NOT NULL AND s."bioEn" <> ''
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND (k."bioEn" IS NULL OR k."bioEn" = '');

UPDATE "Speaker" k SET "socialLinks" = best.val
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."socialLinks" AS val
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."socialLinks" IS NOT NULL AND s."socialLinks" <> ''
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND (k."socialLinks" IS NULL OR k."socialLinks" = '');

-- contactEmail is not listed in the issue but follows the same rule: it is the
-- address the edit link is sent to, and losing it would silently break #79.
UPDATE "Speaker" k SET "contactEmail" = best.val
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."contactEmail" AS val
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."contactEmail" IS NOT NULL AND s."contactEmail" <> ''
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND (k."contactEmail" IS NULL OR k."contactEmail" = '');

-- 4c. Edit-link state. No slug carries more than one token (verified), so the
--     @unique index on editToken cannot fire here.
UPDATE "Speaker" k
SET "editToken" = best."editToken",
    "editLinkLocked" = best."editLinkLocked",
    "editTokenSentAt" = best."editTokenSentAt"
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."editToken", s."editLinkLocked", s."editTokenSentAt"
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."editToken" IS NOT NULL
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND k."editToken" IS NULL;

-- 4d. sponsorId stays on Speaker for now (see the schema comment): only one row
--     carries one, and moving it belongs to the follow-up issue.
UPDATE "Speaker" k SET "sponsorId" = best."sponsorId"
FROM (
  SELECT DISTINCT ON (v.keep_id) v.keep_id, s."sponsorId"
  FROM _speaker_survivor v JOIN "Speaker" s ON s."slug" = v."slug"
  JOIN "Edition" e ON e."id" = s."editionId"
  WHERE s."sponsorId" IS NOT NULL
  ORDER BY v.keep_id, e."year" DESC, s."id" DESC
) best
WHERE k."id" = best.keep_id AND k."sponsorId" IS NULL;

-- 4e. A person is live as soon as one of their rows was live. Without this, a
--     speaker would vanish from the site because the row elected as survivor
--     happened to be the trashed one.
UPDATE "Speaker" k
SET "deletedAt" = NULL
WHERE k."deletedAt" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM _speaker_survivor v
    JOIN "Speaker" s ON s."slug" = v."slug"
    WHERE v.keep_id = k."id" AND s."deletedAt" IS NULL
  );

-- ---------------------------------------------------------------------------
-- 5. Repoint dependents onto the survivor, THEN delete the losers.
--
-- 5a. Talk links. The guard mirrors the EditionCategory step of #338: a talk
--     co-authored by two folded rows would violate the (A,B) primary key.
-- ---------------------------------------------------------------------------
UPDATE "_SpeakerToTalk" st
SET "A" = l.keep_id
FROM _speaker_loser l
WHERE st."A" = l.dup_id
  AND NOT EXISTS (
    SELECT 1 FROM "_SpeakerToTalk" other
    WHERE other."A" = l.keep_id AND other."B" = st."B"
  );

-- Pairs still on a loser duplicate one the survivor already holds. Delete them
-- explicitly rather than letting the FK cascade do it: an unexpected row here
-- means the guard above was wrong, and a cascade would hide that.
DELETE FROM "_SpeakerToTalk" st
USING _speaker_loser l
WHERE st."A" = l.dup_id;

-- 5b. Move the participations created at step 2. The unique index cannot fire:
--     the old @@unique([editionId, slug]) guaranteed no two rows of one slug
--     shared an edition. The guard is belt and braces.
UPDATE "SpeakerEdition" se
SET "speakerId" = l.keep_id
FROM _speaker_loser l
WHERE se."speakerId" = l.dup_id
  AND NOT EXISTS (
    SELECT 1 FROM "SpeakerEdition" other
    WHERE other."speakerId" = l.keep_id AND other."editionId" = se."editionId"
  );

DELETE FROM "SpeakerEdition" se
USING _speaker_loser l
WHERE se."speakerId" = l.dup_id;

-- 5c. The losers now carry nothing.
DELETE FROM "Speaker" s
USING _speaker_loser l
WHERE s."id" = l.dup_id;

DROP TABLE _speaker_survivor;
DROP TABLE _speaker_loser;

-- ---------------------------------------------------------------------------
-- 6. DESTRUCTIVE — the edition link and the per-edition editorial fields now
--    live on the join. Index names taken from the live database, not guessed.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "Speaker_editionId_idx";
DROP INDEX IF EXISTS "Speaker_editionId_slug_key";
ALTER TABLE "Speaker" DROP CONSTRAINT IF EXISTS "Speaker_editionId_fkey";
ALTER TABLE "Speaker" DROP COLUMN "editionId";
ALTER TABLE "Speaker" DROP COLUMN "isFeatured";
ALTER TABLE "Speaker" DROP COLUMN "publicationStatus";

-- ---------------------------------------------------------------------------
-- 7. A slug now identifies a person globally.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Speaker_slug_key" ON "Speaker"("slug");
