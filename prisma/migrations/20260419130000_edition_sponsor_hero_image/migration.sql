-- Optional dedicated hero image for the /devenir-sponsor page.
-- Falls back to Edition.heroImageUrl on the front-office when null.
ALTER TABLE "Edition"
  ADD COLUMN "sponsorHeroImageUrl" TEXT;
