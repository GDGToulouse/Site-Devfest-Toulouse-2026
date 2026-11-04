-- The help desk (#801): a label keeps what it printed (corrected at the desk,
-- or typed for a person without a ticket), and a label may have no ticket.
ALTER TABLE "BadgeLabel" ADD COLUMN "editionId" INTEGER;
ALTER TABLE "BadgeLabel" ADD COLUMN "firstName" TEXT;
ALTER TABLE "BadgeLabel" ADD COLUMN "lastName" TEXT;
ALTER TABLE "BadgeLabel" ADD COLUMN "company" TEXT;

-- Labels printed so far printed their ticket's text, unchanged.
UPDATE "BadgeLabel" AS l
SET "editionId" = a."editionId", "firstName" = a."firstName", "lastName" = a."lastName", "company" = a."company"
FROM "Attendee" AS a
WHERE a."id" = l."attendeeId";

ALTER TABLE "BadgeLabel" ALTER COLUMN "editionId" SET NOT NULL;
ALTER TABLE "BadgeLabel" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "BadgeLabel" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "BadgeLabel" ALTER COLUMN "attendeeId" DROP NOT NULL;

ALTER TABLE "BadgeLabel" ADD CONSTRAINT "BadgeLabel_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "BadgeLabel_editionId_idx" ON "BadgeLabel"("editionId");
