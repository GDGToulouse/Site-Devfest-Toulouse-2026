-- Audit log (#513).
--
-- Every write to a tracked model lands here, filled by the Prisma extension in
-- src/lib/audit.ts. Append-only: rows older than 13 months are purged.

CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'TRASH', 'RESTORE');

CREATE TYPE "AuditChannel" AS ENUM ('ADMIN', 'SPONSOR', 'EDIT_LINK', 'IMPORT', 'API_KEY', 'MCP', 'PUBLIC', 'SYSTEM', 'AUTH');

CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "channel" "AuditChannel" NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "changes" JSONB,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- One index per filter of the history screen, plus the bare date for the
-- unfiltered list and the retention purge.
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_channel_createdAt_idx" ON "AuditLog"("channel", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- SetNull: deleting an account keeps what it did; actorLabel still names it.
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
