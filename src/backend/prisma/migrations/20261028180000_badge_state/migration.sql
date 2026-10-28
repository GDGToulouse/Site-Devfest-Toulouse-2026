-- CreateEnum
CREATE TYPE "BadgeState" AS ENUM ('PRINTED', 'TO_FETCH', 'READY', 'DELIVERED');

-- AlterTable
ALTER TABLE "Attendee" ADD COLUMN "badgeState" "BadgeState" NOT NULL DEFAULT 'PRINTED',
ADD COLUMN "badgeStateVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BadgeTransition" (
    "id" SERIAL NOT NULL,
    "attendeeId" INTEGER NOT NULL,
    "fromState" "BadgeState" NOT NULL,
    "toState" "BadgeState" NOT NULL,
    "userId" TEXT,
    "userLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BadgeTransition_attendeeId_idx" ON "BadgeTransition"("attendeeId");

-- AddForeignKey
ALTER TABLE "BadgeTransition" ADD CONSTRAINT "BadgeTransition_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeTransition" ADD CONSTRAINT "BadgeTransition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
