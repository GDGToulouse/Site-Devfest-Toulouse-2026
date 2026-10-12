-- When an admin last sent the speakers their audience feedback recap (#567).

ALTER TABLE "Edition" ADD COLUMN "feedbackRecapSentAt" TIMESTAMP(3);
