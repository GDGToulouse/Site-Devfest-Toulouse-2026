-- Each speaker's feedback recap, per edition (#865), instead of one date for
-- the whole edition.

-- CreateTable
CREATE TABLE "SpeakerFeedbackRecap" (
    "id" SERIAL NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "speakerId" INTEGER NOT NULL,
    "editionId" INTEGER NOT NULL,

    CONSTRAINT "SpeakerFeedbackRecap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpeakerFeedbackRecap_editionId_speakerId_key" ON "SpeakerFeedbackRecap"("editionId", "speakerId");

-- AddForeignKey
ALTER TABLE "SpeakerFeedbackRecap" ADD CONSTRAINT "SpeakerFeedbackRecap_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakerFeedbackRecap" ADD CONSTRAINT "SpeakerFeedbackRecap_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill what the last send left behind: it ended by stamping the edition,
-- and gave each speaker it reached a fresh edit link, stamped `editTokenSentAt`.
-- A link stamped in the hour before the edition's stamp is that send. Not
-- recoverable: earlier sends (overwritten), and speakers whose link was locked
-- (they got the email but no new link). Those show as "to send".
INSERT INTO "SpeakerFeedbackRecap" ("editionId", "speakerId", "sentAt")
SELECT DISTINCT e."id", s."id", s."editTokenSentAt"
FROM "Edition" e
JOIN "Talk" t ON t."editionId" = e."id" AND t."deletedAt" IS NULL AND t."publicationStatus" = 'PUBLISHED'
JOIN "_SpeakerToTalk" st ON st."B" = t."id"
JOIN "Speaker" s ON s."id" = st."A" AND s."deletedAt" IS NULL
WHERE e."feedbackRecapSentAt" IS NOT NULL
  AND s."editTokenSentAt" BETWEEN e."feedbackRecapSentAt" - INTERVAL '1 hour' AND e."feedbackRecapSentAt";

-- AlterTable
ALTER TABLE "Edition" DROP COLUMN "feedbackRecapSentAt";
