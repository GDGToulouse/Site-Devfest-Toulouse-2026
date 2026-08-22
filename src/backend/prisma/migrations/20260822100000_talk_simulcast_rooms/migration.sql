-- Keynotes become talks, and a talk can be relayed to other rooms (#456).
--
-- #105 ruled that a session occupies one room, and that a keynote shown on a
-- screen elsewhere is declared as an off-session entry. That held until the
-- grid was finished: as a band, a keynote had no detail page, no favourite, no
-- calendar export, and it weighed exactly as much as a coffee break.
--
-- So TalkSimulcast carries the relay rooms, `PLENARY` entries become KEYNOTE
-- talks, and the enum value goes — nothing is kept "just in case".
--
-- Written by hand: `prisma migrate dev` is interactive and unusable here.

-- ---------------------------------------------------------------------------
-- 1. The relay rooms.
-- ---------------------------------------------------------------------------
CREATE TABLE "TalkSimulcast" (
  "id"        SERIAL PRIMARY KEY,
  "talkId"    INTEGER NOT NULL,
  "roomId"    INTEGER,
  "roomLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TalkSimulcast_talkId_roomId_key" ON "TalkSimulcast"("talkId", "roomId");
CREATE INDEX "TalkSimulcast_talkId_idx" ON "TalkSimulcast"("talkId");
CREATE INDEX "TalkSimulcast_roomId_idx" ON "TalkSimulcast"("roomId");

ALTER TABLE "TalkSimulcast"
  ADD CONSTRAINT "TalkSimulcast_talkId_fkey"
  FOREIGN KEY ("talkId") REFERENCES "Talk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TalkSimulcast"
  ADD CONSTRAINT "TalkSimulcast_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Plenary entries become keynote talks.
-- ---------------------------------------------------------------------------
-- In practice this converts nothing outside a development database: the whole
-- schedule model (#105) has not been promoted past dev-j, so no beta or prod
-- row has ever carried this kind. It is written to convert rather than delete
-- anyway — the cost is one statement, and the alternative loses whatever an
-- organiser might have typed.
--
-- The slug takes the entry id as a suffix so two "Keynote d'ouverture" in two
-- editions cannot collide on (editionId, slug). The description is left empty
-- for the organisers to fill: an entry never had one.
INSERT INTO "Talk" (
  "slug", "title", "description", "format", "language", "publicationStatus",
  "startsAt", "endsAt", "editionId", "createdAt", "updatedAt"
)
SELECT
  'keynote-' || e."id",
  e."labelFr",
  '',
  'KEYNOTE',
  'fr',
  'PUBLISHED',
  e."startsAt",
  e."endsAt",
  e."editionId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ScheduleEntry" e
WHERE e."kind" = 'PLENARY';

-- The entry could already name a room; carry it onto the talk it became.
UPDATE "Talk" t
SET "roomId" = e."roomId",
    "roomLabel" = r."name"
FROM "ScheduleEntry" e
LEFT JOIN "Room" r ON r."id" = e."roomId"
WHERE e."kind" = 'PLENARY'
  AND t."slug" = 'keynote-' || e."id"
  AND t."editionId" = e."editionId";

DELETE FROM "ScheduleEntry" WHERE "kind" = 'PLENARY';

-- ---------------------------------------------------------------------------
-- 3. Drop the enum value.
-- ---------------------------------------------------------------------------
-- Postgres cannot remove a value from an enum in place: the type is rebuilt
-- without it, which is also what proves step 2 was exhaustive — a surviving
-- PLENARY row would fail the cast.
ALTER TYPE "ScheduleEntryKind" RENAME TO "ScheduleEntryKind_old";

CREATE TYPE "ScheduleEntryKind" AS ENUM ('BREAK', 'MEAL', 'SOCIAL', 'OTHER');

ALTER TABLE "ScheduleEntry"
  ALTER COLUMN "kind" TYPE "ScheduleEntryKind"
  USING ("kind"::TEXT::"ScheduleEntryKind");

DROP TYPE "ScheduleEntryKind_old";
