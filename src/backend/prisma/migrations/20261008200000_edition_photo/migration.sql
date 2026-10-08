-- The photo gallery of an edition (#112): a curated selection from the media
-- library, in the team's order.

CREATE TABLE "EditionPhoto" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionId" INTEGER NOT NULL,

    CONSTRAINT "EditionPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EditionPhoto_editionId_idx" ON "EditionPhoto"("editionId");

ALTER TABLE "EditionPhoto" ADD CONSTRAINT "EditionPhoto_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
