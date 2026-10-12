-- The audience's opinion of a session, given on the talk page on the day of
-- the event and the next (#563, #564). One row per browser and session: the
-- unique index is the whole of the "one vote per browser" rule.

CREATE TABLE "TalkFeedback" (
    "id" SERIAL NOT NULL,
    "talkId" INTEGER NOT NULL,
    "voterId" TEXT NOT NULL,
    "items" TEXT[],
    "message" TEXT,
    "messageAt" TIMESTAMP(3),
    "messageHidden" BOOLEAN NOT NULL DEFAULT false,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalkFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TalkFeedback_talkId_voterId_key" ON "TalkFeedback"("talkId", "voterId");
CREATE INDEX "TalkFeedback_talkId_idx" ON "TalkFeedback"("talkId");

ALTER TABLE "TalkFeedback" ADD CONSTRAINT "TalkFeedback_talkId_fkey" FOREIGN KEY ("talkId") REFERENCES "Talk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
