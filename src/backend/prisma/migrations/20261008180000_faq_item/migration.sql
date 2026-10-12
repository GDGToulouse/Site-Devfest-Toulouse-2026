-- The public FAQ (#111): one row per question, grouped by theme, bilingual.

CREATE TYPE "FaqTheme" AS ENUM ('VENUE', 'TICKETS', 'PROGRAMME', 'PRACTICAL', 'OTHER');

CREATE TABLE "FaqItem" (
    "id" SERIAL NOT NULL,
    "theme" "FaqTheme" NOT NULL DEFAULT 'OTHER',
    "questionFr" TEXT NOT NULL,
    "questionEn" TEXT NOT NULL DEFAULT '',
    "answerFr" TEXT NOT NULL DEFAULT '',
    "answerEn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);
