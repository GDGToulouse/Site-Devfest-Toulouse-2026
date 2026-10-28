-- Attendees imported from the edition's Billetweb event (#638).

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN "attendeesSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Attendee" (
    "id" SERIAL NOT NULL,
    "editionId" INTEGER NOT NULL,
    "billetwebId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "billetwebTicketId" TEXT NOT NULL,
    "ticketTierId" INTEGER,
    "category" TEXT,
    "orderId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_editionId_billetwebId_key" ON "Attendee"("editionId", "billetwebId");

-- CreateIndex
CREATE INDEX "Attendee_editionId_barcode_idx" ON "Attendee"("editionId", "barcode");

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_ticketTierId_fkey" FOREIGN KEY ("ticketTierId") REFERENCES "TicketTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
