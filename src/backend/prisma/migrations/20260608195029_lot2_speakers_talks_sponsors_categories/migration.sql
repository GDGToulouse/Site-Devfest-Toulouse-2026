-- CreateEnum
CREATE TYPE "SponsorLevel" AS ENUM ('PLATINUM', 'GOLD', 'SILVER', 'SOUTIEN', 'COMMUNAUTE');

-- CreateEnum
CREATE TYPE "TalkFormat" AS ENUM ('CONFERENCE', 'QUICKIE', 'KEYNOTE');

-- CreateEnum
CREATE TYPE "TalkLevel" AS ENUM ('DEBUTANT', 'INTERMEDIAIRE', 'CONFIRME');

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN     "openSponsorLevels" TEXT;

-- CreateTable
CREATE TABLE "Speaker" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "company" TEXT,
    "city" TEXT,
    "bioFr" TEXT,
    "bioEn" TEXT,
    "socialLinks" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "editToken" TEXT,
    "editLinkLocked" BOOLEAN NOT NULL DEFAULT false,
    "editTokenSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionId" INTEGER NOT NULL,
    "sponsorId" INTEGER,

    CONSTRAINT "Speaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talk" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "titleFr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionFr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "format" "TalkFormat" NOT NULL,
    "level" "TalkLevel",
    "language" TEXT NOT NULL,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "room" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionId" INTEGER NOT NULL,
    "categoryId" INTEGER,

    CONSTRAINT "Talk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "level" "SponsorLevel" NOT NULL,
    "websiteUrl" TEXT,
    "descriptionFr" TEXT,
    "descriptionEn" TEXT,
    "socialLinks" TEXT,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "editToken" TEXT,
    "editLinkLocked" BOOLEAN NOT NULL DEFAULT false,
    "editTokenSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionId" INTEGER NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#109E6E',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionId" INTEGER NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SpeakerToTalk" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_SpeakerToTalk_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Speaker_editToken_key" ON "Speaker"("editToken");

-- CreateIndex
CREATE INDEX "Speaker_editionId_idx" ON "Speaker"("editionId");

-- CreateIndex
CREATE INDEX "Speaker_sponsorId_idx" ON "Speaker"("sponsorId");

-- CreateIndex
CREATE UNIQUE INDEX "Speaker_editionId_slug_key" ON "Speaker"("editionId", "slug");

-- CreateIndex
CREATE INDEX "Talk_editionId_idx" ON "Talk"("editionId");

-- CreateIndex
CREATE INDEX "Talk_categoryId_idx" ON "Talk"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Talk_editionId_slug_key" ON "Talk"("editionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sponsor_editToken_key" ON "Sponsor"("editToken");

-- CreateIndex
CREATE INDEX "Sponsor_editionId_idx" ON "Sponsor"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "Sponsor_editionId_slug_key" ON "Sponsor"("editionId", "slug");

-- CreateIndex
CREATE INDEX "Category_editionId_idx" ON "Category"("editionId");

-- CreateIndex
CREATE INDEX "_SpeakerToTalk_B_index" ON "_SpeakerToTalk"("B");

-- AddForeignKey
ALTER TABLE "Speaker" ADD CONSTRAINT "Speaker_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Speaker" ADD CONSTRAINT "Speaker_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talk" ADD CONSTRAINT "Talk_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talk" ADD CONSTRAINT "Talk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SpeakerToTalk" ADD CONSTRAINT "_SpeakerToTalk_A_fkey" FOREIGN KEY ("A") REFERENCES "Speaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SpeakerToTalk" ADD CONSTRAINT "_SpeakerToTalk_B_fkey" FOREIGN KEY ("B") REFERENCES "Talk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
