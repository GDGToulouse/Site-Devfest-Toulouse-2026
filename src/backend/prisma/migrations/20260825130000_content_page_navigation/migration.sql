-- Where a content page appears in the navigation (#420).
--
-- The public navigation is built in code: `getPublicNavEntries()` for the menu,
-- literal links for the footer bar. Nothing loops over the pages table, so a
-- page created from the admin could only be reached by typing its URL.

CREATE TYPE "PageNavLocation" AS ENUM ('NONE', 'HEADER', 'FOOTER');

ALTER TABLE "ContentPage"
  ADD COLUMN "navLocation" "PageNavLocation" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "navOrder" INTEGER NOT NULL DEFAULT 0;

-- The code of conduct and the legal notice already have their permanent link in
-- the footer bar, written in the template. Placing them here as well would print
-- them twice, so they stay at NONE.
