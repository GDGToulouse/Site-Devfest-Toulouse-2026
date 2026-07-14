-- AlterTable
ALTER TABLE "Speaker" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'fr';

-- AlterTable
ALTER TABLE "Sponsor" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'fr';
