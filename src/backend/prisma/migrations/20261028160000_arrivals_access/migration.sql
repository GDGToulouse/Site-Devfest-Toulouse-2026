-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'GUEST';

-- CreateTable
CREATE TABLE "ArrivalsAccess" (
    "id" SERIAL NOT NULL,
    "editionId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "invitationToken" TEXT,
    "invitationSentAt" TIMESTAMP(3),
    "invitationAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrivalsAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArrivalsAccess_invitationToken_key" ON "ArrivalsAccess"("invitationToken");

-- CreateIndex
CREATE INDEX "ArrivalsAccess_userId_idx" ON "ArrivalsAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArrivalsAccess_editionId_email_key" ON "ArrivalsAccess"("editionId", "email");

-- AddForeignKey
ALTER TABLE "ArrivalsAccess" ADD CONSTRAINT "ArrivalsAccess_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalsAccess" ADD CONSTRAINT "ArrivalsAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
