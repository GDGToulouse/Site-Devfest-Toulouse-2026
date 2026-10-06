-- Keep the Sessionize API link of an edition's last successful import, so the
-- next import needs no pasting (#529).

ALTER TABLE "Edition" ADD COLUMN "sessionizeApiUrl" TEXT;
