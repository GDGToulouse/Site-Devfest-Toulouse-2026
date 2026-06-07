-- Drop the previous default (ADMIN) and set EDITOR as the safe default.
-- Existing rows keep their current role — this only affects INSERTs where
-- the application doesn't explicitly set `role`.
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'EDITOR';
