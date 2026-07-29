# Sponsor Identity — Schema & Migration (#129) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `Sponsor` into a global identity plus an `EditionSponsor` participation row, so one company sponsoring N editions is one row plus N participations.

**Architecture:** Mirrors the `Speaker`/`SpeakerEdition` split delivered by #351, but **without any deduplication step** — no sponsor exists on more than one edition today, so the migration is a mechanical 1-for-1 transform. `SponsorJobOffer` moves to the participation; `SponsorContact` stays on the identity.

**Tech Stack:** Prisma 7 (config-first, `prisma.config.ts`), PostgreSQL, Fastify, Vitest, TypeScript ESM (`.js` import specifiers).

**Spec:** [2026-07-29-sponsor-identity-design.md](../specs/2026-07-29-sponsor-identity-design.md)

## Global Constraints

- **Scope is PR 1 of 4.** This plan delivers the schema and migration only. Rewriting the API consumers is #130, admin front #131, public front #132.
- **This PR does NOT compile on its own, by design.** Dropping `Sponsor.editionId` breaks `src/backend/src/routes/sponsors.ts` and `routes/admin/sponsors.ts`, and the existing tests that build sponsors with `editionId`. That breakage is #130's worklist, captured in Task 5. What MUST hold at the end of this plan: the migration applies cleanly, the invariants hold, `sponsor-identity.test.ts` passes, `seed-dev.ts` runs, and `prisma/**` typechecks. Do **not** "fix" `src/routes/**` to make the build green — that is out of scope and belongs to #130.
- **CI will be red on this branch until #130 lands.** Expected. Do not merge this branch to `dev` alone.
- **Language:** code, comments and commit messages in **English**. Communication with the user in French.
- **Commits:** Conventional Commits, subject under 72 chars. Stage named files only — never `git add .` or `git add -A`. One git command per Bash call, never chained with `&&`, never `git -C`.
- **Branch:** work on `feature/us-129-sponsor-identity` (already created, holds the design doc commit).
- **Prisma 7:** the generated client lives in `src/backend/src/generated/prisma/` and is gitignored. Always `pnpm db:generate` after editing the schema. Migration commands read `prisma.config.ts`.
- **Backend commands run from `src/backend/`.** Tests against a live Postgres. From the host, prefix `DATABASE_URL` pointing at `localhost:5432`, otherwise ~44 tests fail with 500s.
- **Do not add backwards-compatibility shims.** No renaming to `_unused`, no re-exporting dead types. If something is unused, delete it.
- **Migration must never silently lose rows.** Every destructive step is preceded by an explicit guard that fails loudly.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/backend/prisma/schema.prisma` | Modify: `Sponsor` loses its per-edition fields, gains `slug @unique`; new `EditionSponsor` model; `SponsorJobOffer` repointed |
| `src/backend/prisma/migrations/20260729xxxxxx_sponsor_identity/migration.sql` | Create: the hand-written migration with its guard and invariants |
| `src/backend/src/__tests__/sponsor-identity.test.ts` | Create: locks the new model's invariants |
| `src/backend/prisma/seed-dev.ts` | Modify: create identity + participation |

`src/backend/src/routes/**` is **deliberately untouched** in this PR — see Task 5.

---

## Task 1: Add EditionSponsor to the Prisma schema

**Files:**
- Modify: `src/backend/prisma/schema.prisma` (models `Sponsor`, `SponsorJobOffer`)

**Interfaces:**
- Produces: model `EditionSponsor` with fields `id`, `editionId`, `sponsorId`, `tierId`, `publicationStatus`, `comKitReceived`, `comKitLogoWebUrl`, `comKitLogoPrintUrl`, `comKitCharterUrl`, `comKitNotes`, `platinumPromoIdea`, `platinumCoBuildIdea`, `createdAt`, `updatedAt`; unique on `(sponsorId, editionId)`. `Sponsor.slug` becomes `@unique`. `SponsorJobOffer.editionSponsorId` replaces `sponsorId`.

- [ ] **Step 1: Read the current models before editing**

Read `src/backend/prisma/schema.prisma` and locate `model Sponsor`, `model SponsorContact`, `model SponsorJobOffer`. Note the exact field list — the migration in Task 2 must match it.

- [ ] **Step 2: Edit `model Sponsor`**

Remove these lines from `model Sponsor`:

```prisma
  publicationStatus   PublicationStatus @default(DRAFT)
  editionId Int
  edition   Edition @relation(fields: [editionId], references: [id], onDelete: Cascade)
  tierId Int
  tier   SponsorTier @relation(fields: [tierId], references: [id])
  comKitReceived      Boolean           @default(false)
  comKitLogoWebUrl    String?
  comKitLogoPrintUrl  String?
  comKitCharterUrl    String?
  comKitNotes         String?
  platinumPromoIdea   String?
  platinumCoBuildIdea String?
  jobOffers SponsorJobOffer[]
  @@unique([editionId, slug])
  @@index([editionId])
  @@index([tierId])
```

Change the slug line to:

```prisma
  // Globally unique since #129: a slug identifies a company, not a
  // participation. Same rule as Speaker.slug (#351).
  slug          String       @unique
```

Add to `model Sponsor`:

```prisma
  editions EditionSponsor[]
```

Keep on `Sponsor`: `name`, `logoUrl`, `websiteUrl`, `descriptionFr`, `descriptionEn`, `socialLinks`, `contactEmail`, `standContacts`, `locale`, `createdAt`, `updatedAt`, `deletedAt`, `speakers`, `contacts`, `@@index([deletedAt])`.

- [ ] **Step 3: Add the EditionSponsor model**

Insert after `model Sponsor`:

```prisma
// Which editions a company sponsored (#129), and on what terms that year.
// The identity/participation split of SpeakerEdition (#351), EditionCategory
// (#338) and EditionSponsorTier (#316).
//
// The tier is bought per edition, and so is everything the organisers track
// while preparing it: the communication kit and the Platinum promo ideas.
// standContacts deliberately stays on Sponsor — the booth team only matters
// for scanning during the event, so its history has no value.
// Pure join row: the trash operates on the Sponsor identity, so no soft delete.
model EditionSponsor {
  id                Int               @id @default(autoincrement())
  publicationStatus PublicationStatus @default(DRAFT)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  sponsorId Int
  sponsor   Sponsor @relation(fields: [sponsorId], references: [id], onDelete: Cascade)
  editionId Int
  edition   Edition @relation(fields: [editionId], references: [id], onDelete: Cascade)

  // Sponsoring tier from the shared catalogue (#317), bought for this edition.
  tierId Int
  tier   SponsorTier @relation(fields: [tierId], references: [id])

  // --- Private fields (#249) — organizers only, NEVER exposed publicly ---
  comKitReceived      Boolean @default(false)
  comKitLogoWebUrl    String?
  comKitLogoPrintUrl  String?
  comKitCharterUrl    String?
  comKitNotes         String?
  // Platinum-only promotional content ideas (#252).
  platinumPromoIdea   String?
  platinumCoBuildIdea String?

  // Job offers are dated by nature and their quota depends on this year's
  // tier (#251), so they hang off the participation, not the company.
  jobOffers SponsorJobOffer[]

  @@unique([sponsorId, editionId])
  @@index([sponsorId])
  @@index([editionId])
  @@index([tierId])
}
```

- [ ] **Step 4: Repoint SponsorJobOffer**

In `model SponsorJobOffer`, replace:

```prisma
  sponsorId Int
  sponsor   Sponsor @relation(fields: [sponsorId], references: [id], onDelete: Cascade)

  @@index([sponsorId])
```

with:

```prisma
  editionSponsorId Int
  editionSponsor   EditionSponsor @relation(fields: [editionSponsorId], references: [id], onDelete: Cascade)

  @@index([editionSponsorId])
```

- [ ] **Step 5: Add the back-relations**

In `model Edition`, add next to the other participation lists:

```prisma
  editionSponsors EditionSponsor[]
```

In `model SponsorTier`, add:

```prisma
  editionSponsors EditionSponsor[]
```

- [ ] **Step 6: Verify the schema is valid**

Run from `src/backend`:

```bash
pnpm exec prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

If it reports a missing back-relation, add the corresponding array field to the named model — do not silence it by making a relation optional.

- [ ] **Step 7: Commit**

```bash
git add src/backend/prisma/schema.prisma
git commit -m "feat(sponsor): split identity from per-edition participation"
```

---

## Task 2: Write the migration

**Files:**
- Create: `src/backend/prisma/migrations/20260729120000_sponsor_identity/migration.sql`

**Interfaces:**
- Consumes: the schema from Task 1.
- Produces: a migration that creates `EditionSponsor`, backfills one row per sponsor, repoints `SponsorJobOffer`, and drops the moved columns.

- [ ] **Step 1: Create the migration directory and file**

Create `src/backend/prisma/migrations/20260729120000_sponsor_identity/migration.sql` with this exact content:

```sql
-- Sponsor becomes a global identity (#129).
--
-- Sponsor carried a mandatory editionId and a per-edition unique slug, so a
-- company sponsoring several editions would exist as several unlinked rows.
-- Sponsor becomes the company, EditionSponsor carries the participation and
-- everything bought or tracked for that year -- the same split as
-- SpeakerEdition (#351), EditionCategory (#338) and EditionSponsorTier (#316).
--
-- NOT destructive in the #351 sense: no sponsor exists on more than one
-- edition today, so there is nothing to fold and no row is deleted. Every
-- Sponsor produces exactly one EditionSponsor.
--
-- Invariants to check on both sides:
--   SELECT count(*) FROM "Sponsor";           -- unchanged
--   SELECT count(*) FROM "EditionSponsor";    -- equals the above
--   SELECT count(*) FROM "SponsorJobOffer";   -- unchanged
--   SELECT count(*) FROM "SponsorContact";    -- unchanged

-- ---------------------------------------------------------------------------
-- 0. GUARD. Step 5 creates a global unique index on Sponsor.slug. If two
--    editions ever shared a slug, that index would fail with a violation that
--    says nothing useful. Fail here instead, naming the problem.
--
--    This cannot happen with today's data (every sponsor is on one edition).
--    It is checked rather than assumed: the #351 migration's hardest bug came
--    from a cascade nobody had verified.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count INTEGER;
  dup_list  TEXT;
BEGIN
  SELECT count(*), string_agg(slug, ', ')
  INTO dup_count, dup_list
  FROM (SELECT "slug" FROM "Sponsor" GROUP BY "slug" HAVING count(*) > 1) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot make Sponsor.slug globally unique: % slug(s) used by more than one sponsor (%). Merge them before migrating.',
      dup_count, dup_list;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. The join table.
-- ---------------------------------------------------------------------------
CREATE TABLE "EditionSponsor" (
  "id" SERIAL PRIMARY KEY,
  "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sponsorId" INTEGER NOT NULL,
  "editionId" INTEGER NOT NULL,
  "tierId" INTEGER NOT NULL,
  "comKitReceived" BOOLEAN NOT NULL DEFAULT false,
  "comKitLogoWebUrl" TEXT,
  "comKitLogoPrintUrl" TEXT,
  "comKitCharterUrl" TEXT,
  "comKitNotes" TEXT,
  "platinumPromoIdea" TEXT,
  "platinumCoBuildIdea" TEXT
);

CREATE UNIQUE INDEX "EditionSponsor_sponsorId_editionId_key" ON "EditionSponsor"("sponsorId", "editionId");
CREATE INDEX "EditionSponsor_sponsorId_idx" ON "EditionSponsor"("sponsorId");
CREATE INDEX "EditionSponsor_editionId_idx" ON "EditionSponsor"("editionId");
CREATE INDEX "EditionSponsor_tierId_idx" ON "EditionSponsor"("tierId");

ALTER TABLE "EditionSponsor"
  ADD CONSTRAINT "EditionSponsor_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionSponsor"
  ADD CONSTRAINT "EditionSponsor_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditionSponsor"
  ADD CONSTRAINT "EditionSponsor_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SponsorTier"("id") ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. One participation per existing sponsor, carrying the per-edition state.
--    Trashed sponsors included: the trash lives on the identity, and restoring
--    one must restore a company that still belongs to its edition.
-- ---------------------------------------------------------------------------
INSERT INTO "EditionSponsor" (
  "sponsorId", "editionId", "tierId", "publicationStatus",
  "comKitReceived", "comKitLogoWebUrl", "comKitLogoPrintUrl",
  "comKitCharterUrl", "comKitNotes", "platinumPromoIdea",
  "platinumCoBuildIdea", "updatedAt"
)
SELECT
  s."id", s."editionId", s."tierId", s."publicationStatus",
  s."comKitReceived", s."comKitLogoWebUrl", s."comKitLogoPrintUrl",
  s."comKitCharterUrl", s."comKitNotes", s."platinumPromoIdea",
  s."platinumCoBuildIdea", CURRENT_TIMESTAMP
FROM "Sponsor" s;

-- ---------------------------------------------------------------------------
-- 3. Job offers hang off the participation. The column is added nullable,
--    backfilled, then made NOT NULL -- an offer with no participation would
--    mean step 2 missed a sponsor, so the SET NOT NULL is the check.
-- ---------------------------------------------------------------------------
ALTER TABLE "SponsorJobOffer" ADD COLUMN "editionSponsorId" INTEGER;

UPDATE "SponsorJobOffer" o
SET "editionSponsorId" = es."id"
FROM "EditionSponsor" es
WHERE es."sponsorId" = o."sponsorId";

ALTER TABLE "SponsorJobOffer" ALTER COLUMN "editionSponsorId" SET NOT NULL;

ALTER TABLE "SponsorJobOffer" DROP CONSTRAINT IF EXISTS "SponsorJobOffer_sponsorId_fkey";
DROP INDEX IF EXISTS "SponsorJobOffer_sponsorId_idx";
ALTER TABLE "SponsorJobOffer" DROP COLUMN "sponsorId";

CREATE INDEX "SponsorJobOffer_editionSponsorId_idx" ON "SponsorJobOffer"("editionSponsorId");
ALTER TABLE "SponsorJobOffer"
  ADD CONSTRAINT "SponsorJobOffer_editionSponsorId_fkey" FOREIGN KEY ("editionSponsorId") REFERENCES "EditionSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. The edition link and the per-edition fields now live on the join.
--    Index names taken from the live schema, not guessed.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "Sponsor_editionId_idx";
DROP INDEX IF EXISTS "Sponsor_tierId_idx";
DROP INDEX IF EXISTS "Sponsor_editionId_slug_key";
ALTER TABLE "Sponsor" DROP CONSTRAINT IF EXISTS "Sponsor_editionId_fkey";
ALTER TABLE "Sponsor" DROP CONSTRAINT IF EXISTS "Sponsor_tierId_fkey";
ALTER TABLE "Sponsor" DROP COLUMN "editionId";
ALTER TABLE "Sponsor" DROP COLUMN "tierId";
ALTER TABLE "Sponsor" DROP COLUMN "publicationStatus";
ALTER TABLE "Sponsor" DROP COLUMN "comKitReceived";
ALTER TABLE "Sponsor" DROP COLUMN "comKitLogoWebUrl";
ALTER TABLE "Sponsor" DROP COLUMN "comKitLogoPrintUrl";
ALTER TABLE "Sponsor" DROP COLUMN "comKitCharterUrl";
ALTER TABLE "Sponsor" DROP COLUMN "comKitNotes";
ALTER TABLE "Sponsor" DROP COLUMN "platinumPromoIdea";
ALTER TABLE "Sponsor" DROP COLUMN "platinumCoBuildIdea";

-- ---------------------------------------------------------------------------
-- 5. A slug now identifies a company globally.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Sponsor_slug_key" ON "Sponsor"("slug");
```

- [ ] **Step 2: Record the row counts BEFORE applying**

Run against the dev database and write the four numbers down — they are the invariants:

```bash
docker compose -f docker-compose.local.yml exec -T db psql -U devfest -d devfest -c "SELECT (SELECT count(*) FROM \"Sponsor\") AS sponsors, (SELECT count(*) FROM \"SponsorJobOffer\") AS offers, (SELECT count(*) FROM \"SponsorContact\") AS contacts;"
```

If the container or credentials differ, read `docker-compose.yml` for the service name and `POSTGRES_USER`/`POSTGRES_DB` rather than guessing.

- [ ] **Step 3: Apply the migration**

From `src/backend`:

```bash
pnpm exec prisma migrate deploy
```

Expected: `1 migration found` then `Applying migration '20260729120000_sponsor_identity'` and no error.

If it fails on the step-0 guard, that is the guard doing its job: two sponsors share a slug and must be merged by hand before retrying. Do not weaken the guard.

- [ ] **Step 4: Verify the invariants**

```bash
docker compose -f docker-compose.local.yml exec -T db psql -U devfest -d devfest -c "SELECT (SELECT count(*) FROM \"Sponsor\") AS sponsors, (SELECT count(*) FROM \"EditionSponsor\") AS participations, (SELECT count(*) FROM \"SponsorJobOffer\") AS offers, (SELECT count(*) FROM \"SponsorContact\") AS contacts;"
```

Expected: `sponsors` = `participations` = the pre-migration sponsor count; `offers` and `contacts` unchanged from Step 2.

If `participations` is lower than `sponsors`, step 2 of the SQL skipped rows — stop and investigate before going further. Do not "fix" it by re-running the INSERT.

- [ ] **Step 5: Regenerate the Prisma client**

```bash
pnpm db:generate
```

- [ ] **Step 6: Commit**

```bash
git add src/backend/prisma/migrations/20260729120000_sponsor_identity/migration.sql
git commit -m "feat(sponsor): migrate to identity plus edition participation"
```

---

## Task 3: Lock the model with tests

**Files:**
- Create: `src/backend/src/__tests__/sponsor-identity.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../lib/prisma.js`, `getSeededEdition()` from `./edition-test-helpers.js`, `tierIdByKey(key: string): Promise<number>` from `./sponsor-test-helpers.js`.

- [ ] **Step 1: Write the failing test**

Create `src/backend/src/__tests__/sponsor-identity.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #129 — a sponsor is a company, not a per-edition row. The slug is global and
// participation lives on EditionSponsor. These are the invariants the rest of
// the sponsor work (#130, #131, #132) is allowed to assume.

const createdSponsorIds: number[] = [];
const createdEditionIds: number[] = [];

afterEach(async () => {
  if (createdSponsorIds.length) {
    // EditionSponsor and SponsorJobOffer cascade from Sponsor.
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
    createdSponsorIds.length = 0;
  }
  // Editions go after sponsors, so participations cascade away first and no FK
  // blocks the delete. Cleaned up here rather than inline at the end of a test:
  // an assertion failure would skip an inline delete, and Edition.year is
  // @unique, so the leaked row would break every later run of the file.
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

describe("Sponsor identity (#129)", () => {
  it("rejects a second sponsor with the same slug, whatever the edition", async () => {
    const slug = `identity-dup-${Date.now()}`;
    const first = await prisma.sponsor.create({ data: { name: "Acme", slug } });
    createdSponsorIds.push(first.id);

    await expect(
      prisma.sponsor.create({ data: { name: "Acme Again", slug } }),
    ).rejects.toThrow();
  });

  it("carries one company across two editions as two participations", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");

    // year is the only required field on Edition, and it is @unique.
    //
    // 1900, NOT a future year: getSeededEdition() picks the most recent edition
    // at or after 2016, so a 2999 row would be handed to whichever parallel
    // test file asked for an edition while this one still existed — exactly the
    // #292 race that helper was written to close. Below 2016 it is invisible.
    const other = await prisma.edition.create({ data: { year: 1900 } });
    createdEditionIds.push(other.id);

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Multi Year Co",
        slug: `identity-multi-${Date.now()}`,
        editions: {
          create: [
            { editionId: edition.id, tierId, publicationStatus: "PUBLISHED" },
            { editionId: other.id, tierId, publicationStatus: "DRAFT" },
          ],
        },
      },
      include: { editions: true },
    });
    createdSponsorIds.push(sponsor.id);

    expect(sponsor.editions).toHaveLength(2);

    const years = await prisma.editionSponsor.findMany({
      where: { sponsorId: sponsor.id },
      select: { edition: { select: { year: true } }, publicationStatus: true },
    });
    expect(years.map((p) => p.edition.year).sort()).toEqual([edition.year, 1900].sort());
  });

  it("refuses two participations of one company on the same edition", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Once Per Year Co",
        slug: `identity-once-${Date.now()}`,
        editions: { create: [{ editionId: edition.id, tierId }] },
      },
    });
    createdSponsorIds.push(sponsor.id);

    await expect(
      prisma.editionSponsor.create({ data: { sponsorId: sponsor.id, editionId: edition.id, tierId } }),
    ).rejects.toThrow();
  });

  it("hangs job offers off the participation, not the company", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Hiring Co",
        slug: `identity-offers-${Date.now()}`,
        editions: {
          create: [{
            editionId: edition.id,
            tierId,
            jobOffers: { create: [{ title: "Dev", url: "https://example.org/job" }] },
          }],
        },
      },
      include: { editions: { include: { jobOffers: true } } },
    });
    createdSponsorIds.push(sponsor.id);

    expect(sponsor.editions[0].jobOffers).toHaveLength(1);
    expect(sponsor.editions[0].jobOffers[0].title).toBe("Dev");
  });

  it("keeps contacts on the company, shared across its editions", async () => {
    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Contactable Co",
        slug: `identity-contact-${Date.now()}`,
        contacts: { create: [{ email: "boss@example.org" }] },
      },
      include: { contacts: true },
    });
    createdSponsorIds.push(sponsor.id);

    expect(sponsor.contacts).toHaveLength(1);
    expect(sponsor.contacts[0].email).toBe("boss@example.org");
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

From `src/backend`, with `DATABASE_URL` pointing at the running Postgres:

```bash
pnpm exec vitest run src/__tests__/sponsor-identity.test.ts
```

Expected: 5 passed.

These tests describe the schema built in Tasks 1–2, so they pass on first run. If any fails, the schema or migration is wrong — fix that, not the test.

If several tests fail with 500s or connection errors, `DATABASE_URL` is pointing at the Docker-internal host. Prefix it with the `localhost:5432` form.

- [ ] **Step 3: Commit**

```bash
git add src/backend/src/__tests__/sponsor-identity.test.ts
git commit -m "test(sponsor): lock the identity and participation invariants"
```

---

## Task 4: Update seed-dev to the new model

**Files:**
- Modify: `src/backend/prisma/seed-dev.ts`

**Interfaces:**
- Consumes: `EditionSponsor` from Task 1.

- [ ] **Step 1: Read the sponsor block**

Read `src/backend/prisma/seed-dev.ts` around the `DEMO_SPONSORS` loop (the `prisma.sponsor.create` call near line 487) and the teardown (`prisma.sponsor.deleteMany({ where: { editionId: edition.id } })` near line 324).

- [ ] **Step 2: Rewrite the creation as an upsert keyed on slug**

Steps 2 and 3 are one change in two halves — read both before editing either.

The identity must now SURVIVE a re-seed, exactly like speakers (#351) and categories (#338) already do in this same file. That means the teardown drops only the participation (Step 3), which in turn means the creation can no longer be a `create`: `Sponsor.slug` is globally `@unique` since Task 1, so the second run would throw on a duplicate slug.

Convert `prisma.sponsor.create` to an `upsert` keyed on `slug`, identity fields in both branches, participation nested. Follow the shape the speaker seeding further down this same file already uses (upsert the identity by slug, then upsert the participation on `speakerId_editionId`):

```ts
await prisma.sponsor.upsert({
  where: { slug: s.slug },
  // ...identity fields unchanged in BOTH create and update: name, logoUrl,
  // websiteUrl, descriptionFr, descriptionEn, socialLinks, contactEmail...
  create: {
    slug: s.slug,
    editions: {
      create: [{
        editionId: edition.id,
        tierId: sponsorTiers[DEMO_LEVEL_TO_TIER[s.level]].id,
        publicationStatus: "PUBLISHED",
      }],
    },
  },
  update: {
    editions: {
      create: [{
        editionId: edition.id,
        tierId: sponsorTiers[DEMO_LEVEL_TO_TIER[s.level]].id,
        publicationStatus: "PUBLISHED",
      }],
    },
  },
});
```

- [ ] **Step 3: Fix the teardown — participation only, never the identity**

`prisma.sponsor.deleteMany({ where: { editionId: edition.id } })` no longer compiles — `editionId` is not a field of `Sponsor`.

Do **not** replace it with `sponsor.deleteMany({ where: { editions: { some: { editionId } } } })`. That compiles, but it deletes the company identity, and `EditionSponsor.sponsor` is `onDelete: Cascade` — so it would silently destroy that company's participations in every OTHER edition. The two lines around it in the same block (speakers at ~line 320, categories at ~line 325) both carry comments explaining why identities must survive; this line must follow the same rule.

```ts
// Sponsors are companies since #129, shared across editions like speakers and
// categories: deleting them would wipe identities other editions still point
// at. Only this edition's participations go; the identities are upserted by slug.
await prisma.editionSponsor.deleteMany({ where: { editionId: edition.id } });
```

- [ ] **Step 4: Fix any remaining sponsor lookups**

Search the file for other sponsor queries keyed on the edition:

```bash
grep -n "sponsor" src/backend/prisma/seed-dev.ts
```

The lookup `where: { editionId: edition.id, slug: "garonne-digital" }` (near line 520) becomes `where: { slug: "garonne-digital" }` — the slug is globally unique now.

- [ ] **Step 5: Typecheck**

From `src/backend`:

```bash
pnpm typecheck
```

Expected: errors in `src/routes/**` about `editionId`, `tierId` and `publicationStatus` on `Sponsor` — **those are expected and belong to #130**. There must be no error in `prisma/seed-dev.ts`.

- [ ] **Step 6: Run the seed TWICE in a row**

```bash
pnpm exec tsx prisma/seed-dev.ts
pnpm exec tsx prisma/seed-dev.ts
```

Both runs must complete without error, logging the sponsor count as before.

Twice, not once: the seed is re-run routinely and in CI, and the identity/participation split moved where the idempotency comes from. A single green run does not prove it — an upsert bug or a teardown that leaves the identity behind only shows up on the second pass, as a unique-constraint violation on `slug`.

- [ ] **Step 7: Verify the seeded shape**

```bash
docker compose -f docker-compose.local.yml exec -T db psql -U devfest -d devfest -c "SELECT (SELECT count(*) FROM \"Sponsor\") AS sponsors, (SELECT count(*) FROM \"EditionSponsor\") AS participations;"
```

Expected: both counts equal and non-zero, and **identical after the first and second run** — a climbing participation count means the teardown is not clearing what the upsert re-creates.

- [ ] **Step 8: Commit**

```bash
git add src/backend/prisma/seed-dev.ts
git commit -m "chore(seed): create sponsors as identity plus participation"
```

---

## Task 5: Record the handoff to #130

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-sponsor-identity-schema.md` (this file — the Status section below)

At this point the schema, migration, tests and seed are done, and `pnpm typecheck` **still fails inside `src/routes/**`**. That is the intended end state of this PR: the socle lands first, the consumers are rewritten in #130.

- [ ] **Step 1: Capture the exact compile errors**

From `src/backend`:

```bash
pnpm typecheck 2>&1 | tee /tmp/sponsor-typecheck.txt
```

- [ ] **Step 2: Turn them into the #130 worklist**

Append to the Status section at the bottom of this plan: the file list and, per file, the failing symbol. This is the checklist #130 works through — it is cheaper to record it now, while the errors are in front of you, than to rediscover it later.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-29-sponsor-identity-schema.md
git commit -m "docs(sponsor): record the #130 consumer worklist"
```

---

## Verification Before Opening the PR

Run these and paste the real output into the PR description. Do not claim a step passed without having run it.

- [ ] `pnpm exec prisma validate` — schema valid
- [ ] `pnpm exec prisma migrate deploy` on a **fresh** database — applies cleanly from zero
- [ ] Invariants: `count(Sponsor) == count(EditionSponsor)`, offers and contacts unchanged
- [ ] `pnpm exec vitest run src/__tests__/sponsor-identity.test.ts` — 5 passed
- [ ] `pnpm exec tsx prisma/seed-dev.ts` — completes clean
- [ ] `pnpm typecheck` — fails **only** in `src/routes/**`, per Task 5

The fresh-database run matters: CI applies migrations from zero on every push, so a migration that only works against the dev database breaks the pipeline.

---

## Status

_Filled in by Task 5._

### #130 consumer worklist

_To be captured from the typecheck output._
