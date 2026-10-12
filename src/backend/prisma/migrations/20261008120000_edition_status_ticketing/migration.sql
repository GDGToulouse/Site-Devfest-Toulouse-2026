-- A home page for the last month before the event (#576): it stops looking for
-- sponsors and sends visitors to the ticket office. Placed before
-- SEE_YOU_NEXT_YEAR so the values read in the order an edition goes through.

ALTER TYPE "EditionStatus" ADD VALUE 'TICKETING' BEFORE 'SEE_YOU_NEXT_YEAR';
