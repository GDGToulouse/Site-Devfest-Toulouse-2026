-- The last week before the event and the day itself (#577): the home page
-- helps the participants prepare their day, then follow it.

ALTER TYPE "EditionStatus" ADD VALUE 'PROGRAMME' BEFORE 'SEE_YOU_NEXT_YEAR';
ALTER TYPE "EditionStatus" ADD VALUE 'EVENT_DAY' BEFORE 'SEE_YOU_NEXT_YEAR';
