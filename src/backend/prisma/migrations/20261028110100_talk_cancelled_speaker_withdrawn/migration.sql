-- A cancelled talk and a withdrawn speaker participation (#726), distinct from
-- a draft. Talks and participations get their own status enum, so articles,
-- the FAQ and sponsor participations keep PublicationStatus as it is. Existing
-- values convert one for one: DRAFT and PUBLISHED exist in both new enums.

-- CreateEnum
CREATE TYPE "TalkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SpeakerEditionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN');

-- AlterTable: the default is typed after the old enum, so it goes first.
ALTER TABLE "Talk" ALTER COLUMN "publicationStatus" DROP DEFAULT;
ALTER TABLE "Talk" ALTER COLUMN "publicationStatus" TYPE "TalkStatus" USING ("publicationStatus"::text::"TalkStatus");
ALTER TABLE "Talk" ALTER COLUMN "publicationStatus" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "SpeakerEdition" ALTER COLUMN "publicationStatus" DROP DEFAULT;
ALTER TABLE "SpeakerEdition" ALTER COLUMN "publicationStatus" TYPE "SpeakerEditionStatus" USING ("publicationStatus"::text::"SpeakerEditionStatus");
ALTER TABLE "SpeakerEdition" ALTER COLUMN "publicationStatus" SET DEFAULT 'DRAFT';
