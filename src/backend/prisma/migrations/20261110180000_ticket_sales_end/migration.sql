-- #822: when registrations close on Billetweb, the site greys its tickets out.
-- Imported from Billetweb when the event exposes it, editable by hand.
ALTER TABLE "Edition" ADD COLUMN "ticketSalesEndAt" TIMESTAMP(3);
