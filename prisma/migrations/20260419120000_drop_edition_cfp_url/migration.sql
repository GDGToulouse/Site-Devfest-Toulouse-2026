-- Edition.cfpUrl is dead: the CFP URL is now stored in SiteSetting
-- (key "cfp_sessionize_url") and exposed as cfpSettings.sessionizeUrl.
-- The hero / header read from there. No backfill: any value here is
-- already manually re-saved in the CFP tab by the admin.
ALTER TABLE "Edition" DROP COLUMN IF EXISTS "cfpUrl";
