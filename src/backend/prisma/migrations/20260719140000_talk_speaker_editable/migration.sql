-- Speaker editing of a talk is opt-in, granted per talk by the organizers (#289).
-- Existing talks default to read-only, which is the intended behaviour: editing
-- was previously always open, and this migration closes it until an admin opens it.
ALTER TABLE "Talk" ADD COLUMN "isSpeakerEditable" BOOLEAN NOT NULL DEFAULT false;
