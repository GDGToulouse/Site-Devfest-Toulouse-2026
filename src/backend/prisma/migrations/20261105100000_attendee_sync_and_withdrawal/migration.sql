-- Billetweb sync every five minutes on event day (#800): what went wrong on
-- the last attempt, for the admin to see; null once an import succeeds.
ALTER TABLE "Edition" ADD COLUMN "attendeesSyncError" TEXT;

-- A badge printed for a ticket refunded since (#800): when the help desk took
-- it back, off its counter's screen and the desk's list.
ALTER TABLE "Attendee" ADD COLUMN "badgeWithdrawnAt" TIMESTAMP(3);
