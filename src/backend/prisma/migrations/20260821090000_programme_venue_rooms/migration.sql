-- Venue, rooms and schedule entries (#105).
--
-- The seven flat `venue*` columns move off Edition onto a shared Venue, and
-- Talk.room (free text) becomes a foreign key. Both are backfilled before the
-- old columns are dropped, so no data is lost.
--
-- Written by hand: `prisma migrate dev` is interactive and unusable here.

-- ---------------------------------------------------------------------------
-- 1. New tables.
-- ---------------------------------------------------------------------------
CREATE TABLE "Venue" (
  "id"            SERIAL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "address"       TEXT,
  "lat"           DOUBLE PRECISION,
  "lng"           DOUBLE PRECISION,
  "transports"    TEXT,
  "parking"       TEXT,
  "directionsUrl" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "Venue_name_key" ON "Venue"("name");

CREATE TABLE "Room" (
  "id"        SERIAL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "capacity"  INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "venueId"   INTEGER NOT NULL
);

CREATE UNIQUE INDEX "Room_venueId_name_key" ON "Room"("venueId", "name");
CREATE INDEX "Room_venueId_idx" ON "Room"("venueId");

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ScheduleEntryKind" AS ENUM ('BREAK', 'MEAL', 'PLENARY', 'SOCIAL', 'OTHER');

CREATE TABLE "ScheduleEntry" (
  "id"        SERIAL PRIMARY KEY,
  "kind"      "ScheduleEntryKind" NOT NULL,
  "labelFr"   TEXT NOT NULL,
  "labelEn"   TEXT NOT NULL,
  "startsAt"  TIMESTAMP(3) NOT NULL,
  "endsAt"    TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "editionId" INTEGER NOT NULL,
  "roomId"    INTEGER
);

CREATE INDEX "ScheduleEntry_editionId_idx" ON "ScheduleEntry"("editionId");
CREATE INDEX "ScheduleEntry_roomId_idx" ON "ScheduleEntry"("roomId");

ALTER TABLE "ScheduleEntry"
  ADD CONSTRAINT "ScheduleEntry_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleEntry"
  ADD CONSTRAINT "ScheduleEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. New columns, all nullable so the backfill can run before anything is
--    dropped.
-- ---------------------------------------------------------------------------
ALTER TABLE "Edition" ADD COLUMN "venueId" INTEGER;
ALTER TABLE "Talk" ADD COLUMN "roomId" INTEGER;
ALTER TABLE "Talk" ADD COLUMN "roomLabel" TEXT;

-- ---------------------------------------------------------------------------
-- 3. Backfill the venues — one row per distinct venue name.
--
--    Editions that share a name share a venue, which is the whole point: the
--    dev seed alone carries "Diagora" twice and "Centre de Congrès Pierre
--    Baudis" twice. DISTINCT ON picks the most recent edition's details as the
--    canonical ones, so an address corrected last year wins over an older typo.
-- ---------------------------------------------------------------------------
INSERT INTO "Venue" ("name", "address", "lat", "lng", "transports", "parking", "directionsUrl", "updatedAt")
SELECT DISTINCT ON (e."venueName")
  e."venueName",
  e."venueAddress",
  e."venueLat",
  e."venueLng",
  e."venueTransports",
  e."venueParking",
  e."venueDirectionsUrl",
  CURRENT_TIMESTAMP
FROM "Edition" e
WHERE e."venueName" IS NOT NULL AND e."venueName" <> ''
ORDER BY e."venueName", e."year" DESC;

UPDATE "Edition" e
SET "venueId" = v."id"
FROM "Venue" v
WHERE v."name" = e."venueName";

-- ---------------------------------------------------------------------------
-- 4. Backfill the rooms from the free-text Talk.room, scoped to the venue of
--    the talk's edition.
--
--    A talk whose edition has no venue cannot produce a room — there is nothing
--    to attach it to. Its `room` text is preserved in `roomLabel` below rather
--    than dropped, so the information survives the migration either way.
-- ---------------------------------------------------------------------------
INSERT INTO "Room" ("name", "venueId", "updatedAt")
SELECT DISTINCT t."room", e."venueId", CURRENT_TIMESTAMP
FROM "Talk" t
JOIN "Edition" e ON e."id" = t."editionId"
WHERE t."room" IS NOT NULL AND t."room" <> '' AND e."venueId" IS NOT NULL
ON CONFLICT ("venueId", "name") DO NOTHING;

UPDATE "Talk" t
SET "roomId" = r."id"
FROM "Edition" e, "Room" r
WHERE e."id" = t."editionId"
  AND r."venueId" = e."venueId"
  AND r."name" = t."room";

-- Freeze the label on every talk that had one, whether or not a Room could be
-- created for it (#375).
UPDATE "Talk" SET "roomLabel" = "room" WHERE "room" IS NOT NULL AND "room" <> '';

-- ---------------------------------------------------------------------------
-- 5. Wire the foreign keys, then drop what has been moved.
-- ---------------------------------------------------------------------------
CREATE INDEX "Edition_venueId_idx" ON "Edition"("venueId");
CREATE INDEX "Talk_roomId_idx" ON "Talk"("roomId");

ALTER TABLE "Edition"
  ADD CONSTRAINT "Edition_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Talk"
  ADD CONSTRAINT "Talk_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Edition" DROP COLUMN "venueName";
ALTER TABLE "Edition" DROP COLUMN "venueAddress";
ALTER TABLE "Edition" DROP COLUMN "venueLat";
ALTER TABLE "Edition" DROP COLUMN "venueLng";
ALTER TABLE "Edition" DROP COLUMN "venueTransports";
ALTER TABLE "Edition" DROP COLUMN "venueParking";
ALTER TABLE "Edition" DROP COLUMN "venueDirectionsUrl";
ALTER TABLE "Talk" DROP COLUMN "room";
