-- Edition linked to its Billetweb event, tiers keyed by their Billetweb id,
-- "outside the flow" tiers for the arrivals desk (#637). Existing tiers get no
-- Billetweb id here: the first re-import attaches them by name.

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN "billetwebEventId" TEXT,
ADD COLUMN "billetwebEventName" TEXT;

-- AlterTable
ALTER TABLE "TicketTier" ADD COLUMN "billetwebTicketId" TEXT,
ADD COLUMN "isOutsideFlow" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "TicketTier_editionId_billetwebTicketId_key" ON "TicketTier"("editionId", "billetwebTicketId");
