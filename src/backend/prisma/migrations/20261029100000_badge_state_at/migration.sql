-- AlterTable
ALTER TABLE "Attendee" ADD COLUMN "badgeStateAt" TIMESTAMP(3);

-- Badges already moved take the time of their last transition.
UPDATE "Attendee" AS a
SET "badgeStateAt" = t."createdAt"
FROM (
  SELECT "attendeeId", MAX("createdAt") AS "createdAt"
  FROM "BadgeTransition"
  GROUP BY "attendeeId"
) AS t
WHERE t."attendeeId" = a."id";
