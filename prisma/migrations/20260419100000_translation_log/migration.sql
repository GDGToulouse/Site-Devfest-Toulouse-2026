-- TranslationLog records every Gemini translation request for observability:
-- usage tracking, quota monitoring, error rate, per-user stats.
CREATE TABLE "TranslationLog" (
  "id"             SERIAL PRIMARY KEY,
  "userId"         TEXT,
  "sourceLang"     TEXT NOT NULL,
  "targetLang"     TEXT NOT NULL,
  "format"         TEXT NOT NULL,
  "model"          TEXT NOT NULL,
  "inputChars"     INTEGER NOT NULL DEFAULT 0,
  "outputChars"    INTEGER NOT NULL DEFAULT 0,
  "inputTokens"    INTEGER NOT NULL DEFAULT 0,
  "outputTokens"   INTEGER NOT NULL DEFAULT 0,
  "durationMs"     INTEGER NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL,
  "errorCode"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TranslationLog_createdAt_idx" ON "TranslationLog" ("createdAt");
CREATE INDEX "TranslationLog_userId_idx" ON "TranslationLog" ("userId");
CREATE INDEX "TranslationLog_status_idx" ON "TranslationLog" ("status");
