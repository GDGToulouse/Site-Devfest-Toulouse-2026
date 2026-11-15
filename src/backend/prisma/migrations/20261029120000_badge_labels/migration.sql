-- AlterTable
ALTER TABLE "Attendee" ADD COLUMN "labelDeliveredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BadgeLabel" (
    "id" SERIAL NOT NULL,
    "attendeeId" INTEGER NOT NULL,
    "userId" TEXT,
    "userLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BadgeLabel_attendeeId_idx" ON "BadgeLabel"("attendeeId");

-- AddForeignKey
ALTER TABLE "BadgeLabel" ADD CONSTRAINT "BadgeLabel_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeLabel" ADD CONSTRAINT "BadgeLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
