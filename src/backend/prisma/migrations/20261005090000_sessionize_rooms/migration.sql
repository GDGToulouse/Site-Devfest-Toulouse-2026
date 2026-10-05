-- Pair each Sessionize room with a room of the edition's venue (#519), so the
-- import can place the sessions it brings in the schedule grid.

CREATE TABLE "SessionizeRoom" (
  "id" SERIAL NOT NULL,
  "sessionizeId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "editionId" INTEGER NOT NULL,
  "roomId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SessionizeRoom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionizeRoom_editionId_sessionizeId_key" ON "SessionizeRoom"("editionId", "sessionizeId");
CREATE INDEX "SessionizeRoom_roomId_idx" ON "SessionizeRoom"("roomId");

ALTER TABLE "SessionizeRoom"
  ADD CONSTRAINT "SessionizeRoom_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionizeRoom"
  ADD CONSTRAINT "SessionizeRoom_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
