-- Keep the name a file had on the uploader's machine (#378).
--
-- Stored names are `<timestamp>-<random>.<ext>`: they identify nothing, and a
-- PDF has no thumbnail to recognise it by either. Nullable on purpose — every
-- file uploaded before this column existed has no name left to recover, and
-- the interface falls back to the stored one.
ALTER TABLE "FileMetadata" ADD COLUMN "originalName" TEXT;
