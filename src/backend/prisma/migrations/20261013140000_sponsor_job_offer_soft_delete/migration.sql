-- Job offers go through the trash like every other record (#609): until now a
-- deletion, by the sponsor or the team, was final.

ALTER TABLE "SponsorJobOffer" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "SponsorJobOffer_deletedAt_idx" ON "SponsorJobOffer"("deletedAt");
