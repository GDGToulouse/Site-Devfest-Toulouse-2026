-- A test mode that opens the audience feedback before the event day, so the
-- team can check it works, production included (#566).

ALTER TABLE "Edition" ADD COLUMN "feedbackTestMode" BOOLEAN NOT NULL DEFAULT false;
