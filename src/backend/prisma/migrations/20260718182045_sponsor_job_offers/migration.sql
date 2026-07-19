-- CreateTable
CREATE TABLE "SponsorJobOffer" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sponsorId" INTEGER NOT NULL,

    CONSTRAINT "SponsorJobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SponsorJobOffer_sponsorId_idx" ON "SponsorJobOffer"("sponsorId");

-- AddForeignKey
ALTER TABLE "SponsorJobOffer" ADD CONSTRAINT "SponsorJobOffer_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
