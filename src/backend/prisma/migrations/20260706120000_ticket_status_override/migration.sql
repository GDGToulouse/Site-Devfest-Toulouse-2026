-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('AVAILABLE', 'SOLD_OUT', 'COMING_SOON');

-- AlterTable
ALTER TABLE "TicketTier" ADD COLUMN     "isSoldOut" BOOLEAN,
ADD COLUMN     "manualStatus" "TicketStatus";
