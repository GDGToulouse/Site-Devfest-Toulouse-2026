# Sponsor Backend on the Identity/Participation Model (#130) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every consumer of the `Sponsor` model onto the identity/participation split delivered by #129, so the app compiles and the test suite passes again.

**Architecture:** One temporal rule governs the public shape — the sponsor page highlights the featured edition, past years are only tags. Queries move to `EditionSponsor`; API response shapes stay byte-identical **except** `/api/sponsors/:slug`, where `tier` becomes nullable and `editions: number[]` appears.

**Tech Stack:** Fastify, Prisma 7 (client generated to `src/backend/src/generated/prisma/`), Vitest against a live Postgres, TypeScript ESM (`.js` import specifiers), Next.js 16 App Router for the one frontend file.

**Spec:** [2026-07-29-sponsor-backend-design.md](../specs/2026-07-29-sponsor-backend-design.md)
**Predecessor:** [2026-07-29-sponsor-identity-schema.md](2026-07-29-sponsor-identity-schema.md) (#129 — schema + migration, already merged into this branch)

## Global Constraints

- **Branch:** `feature/us-129-sponsor-identity` (already holds #129). Never checkout another branch.
- **Language:** code, comments and commit messages in **English**. Communication with the user in French.
- **Commits:** Conventional Commits, subject under 72 chars. Stage named files only — never `git add .` / `git add -A`. One git command per Bash call, never chained with `&&`, never `git -C`.
- **Shell cwd persists between commands.** Backend commands run from `src/backend`; `cd /c/dev/devfesttoulouse/Site-Devfest-Toulouse-2026` to get back to the repo root.
- **DATABASE_URL must point at localhost** or ~44 tests fail with 500s. The repo `.env` targets the Docker-internal host and may be unreadable (blocked as a secret). Prefix commands: `DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest"`. Never write to `.env`, never print secrets into a report.
- **Docker compose must name the file** — this repo has no default `docker-compose.yml`: `docker compose -f docker-compose.local.yml exec -T db psql -U devfest -d devfest -c "..."` from the repo root. Postgres user/password/db are all `devfest`, already running on localhost:5432.
- **Do NOT touch** `src/backend/prisma/schema.prisma`, any file under `src/backend/prisma/migrations/`, or `src/backend/prisma/seed-dev.ts`. #129 owns them and they are correct.
- **No backwards-compatibility shims.** No renaming to `_unused`, no re-exporting dead types, no keeping a field alive "for now". If something is unused, delete it.
- **API shapes are the contract.** `/api/sponsors` and `/api/job-offers` must not change by one byte. The existing tests prove it — if a test demands a changed assertion in those areas, you broke something. The single exception is `/api/sponsors/:slug` (Task 2).
- **Definition of done for the whole plan:** `pnpm typecheck` clean, `pnpm test` green (backend), `pnpm lint` + `pnpm build` clean (frontend).

## The temporal rule (memorise this — it decides most questions)

| Data | Featured edition | Past editions |
|---|---|---|
| `tier` | highlighted on the sponsor page | absent from the page — lives on the edition's recap page |
| `jobOffers` | shown | **never** |
| participation | — | year tag, linking to `/editions/<year>` |

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/backend/src/__tests__/sponsor-test-helpers.ts` | Fixture factory — port once, unblocks many test files | 1 |
| `src/backend/src/routes/sponsors.ts` | Public list / detail / job-offers | 2 |
| `src/backend/src/routes/speakers.ts` | A speaker's employer per year | 3 |
| `src/backend/src/routes/editions.ts` | Public per-year sponsor counts | 3 |
| `src/backend/src/routes/admin/editions.ts` | Admin per-edition sponsor count | 3 |
| `src/backend/src/routes/admin/sponsor-tiers.ts` | Tier-in-use check | 3 |
| `src/backend/src/routes/admin/sponsors.ts` | 12 admin endpoints (412 lines) | 4 |
| `src/backend/src/routes/edit.ts` | Magic-link sponsor editing | 5 |
| `src/frontend/src/lib/types.ts` + `src/frontend/src/app/[locale]/sponsors/[slug]/page.tsx` | `SponsorDetail` contract + the page reading it | 6 |
| 13 remaining `src/backend/src/__tests__/*.test.ts` | Fixtures on the new model | spread across 2–5 |

---

## Task 1: Port the sponsor test helpers

The highest-leverage change in the plan: several test files build sponsors through this factory, so porting it once clears their fixtures.

**Files:**
- Modify: `src/backend/src/__tests__/sponsor-test-helpers.ts`

**Interfaces:**
- Produces: `createSponsorWithToken(data, token, contact?)` — `data` becomes `SponsorFixture` (below), not `Prisma.SponsorUncheckedCreateInput`. Callers pass identity fields plus `editionId`/`tierId`/`publicationStatus`, and the helper routes the last three into the nested participation. Also produces `tierIdByKey(key: string): Promise<number>` (unchanged).

- [ ] **Step 1: Read the current helper**

```bash
cat src/backend/src/__tests__/sponsor-test-helpers.ts
```

Note that `createSponsorWithToken` takes `Prisma.SponsorUncheckedCreateInput` and that the `Prisma` type import exists for that reason.

- [ ] **Step 2: Introduce the fixture type and route the participation fields**

Replace the `createSponsorWithToken` signature and body. Keep `tierIdByKey` exactly as it is.

```ts
// A sponsor fixture on the identity/participation model (#129). Callers still
// pass editionId/tierId/publicationStatus flat — those are what a test cares
// about — and this factory files them into the participation.
export interface SponsorFixture {
  name: string;
  slug: string;
  editionId: number;
  tierId: number;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  logoUrl?: string | null;
  websiteUrl?: string | null;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  socialLinks?: string | null;
  contactEmail?: string | null;
  standContacts?: string | null;
  locale?: string;
}

export async function createSponsorWithToken(
  data: SponsorFixture,
  token: string,
  contact?: { email?: string; sentAt?: Date; locked?: boolean },
) {
  const { editionId, tierId, publicationStatus, ...identity } = data;
  const sponsor = await prisma.sponsor.create({
    data: {
      ...identity,
      editions: {
        create: [{ editionId, tierId, publicationStatus: publicationStatus ?? "DRAFT" }],
      },
    },
  });
  await prisma.sponsorContact.create({
    data: {
      sponsorId: sponsor.id,
      email: contact?.email ?? sponsor.contactEmail ?? "contact@example.org",
      editToken: token,
      editTokenSentAt: contact?.sentAt ?? new Date(),
      editLinkLocked: contact?.locked ?? false,
    },
  });
  return sponsor;
}
```

- [ ] **Step 3: Add a participation-aware fixture for tests that need no token**

Several files create a sponsor directly with `prisma.sponsor.create` and a flat `editionId`. Give them one factory instead of each inventing the nesting:

```ts
// Same shape as createSponsorWithToken, without the modification-link contact.
export async function createSponsorFixture(data: SponsorFixture) {
  const { editionId, tierId, publicationStatus, ...identity } = data;
  return prisma.sponsor.create({
    data: {
      ...identity,
      editions: {
        create: [{ editionId, tierId, publicationStatus: publicationStatus ?? "DRAFT" }],
      },
    },
  });
}
```

- [ ] **Step 4: Fix the stale comment at the top of the file**

The header says "Sponsors carry a tierId FK now, not a level enum" — true of the participation now, not of the sponsor. Correct it to name where the tier lives:

```ts
// Resolve a seeded SponsorTier id from its stable key (#317). The tier is bought
// per edition since #129, so it is set on the participation, not the company.
```

- [ ] **Step 5: Typecheck the helper file**

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm typecheck 2>&1 | grep "sponsor-test-helpers"
```

Expected: empty. Errors elsewhere are expected at this stage — later tasks own them.

- [ ] **Step 6: Commit**

```bash
git add src/backend/src/__tests__/sponsor-test-helpers.ts
git commit -m "test(sponsor): fixtures build identity plus participation"
```

---

## Task 2: Public sponsor endpoints

**Files:**
- Modify: `src/backend/src/routes/sponsors.ts`
- Modify: `src/backend/src/__tests__/public-sponsors.test.ts`
- Modify: `src/backend/src/__tests__/sponsor-job-offers.test.ts`

**Interfaces:**
- Consumes: `tierIdByKey`, `createSponsorFixture` from Task 1.
- Produces: the `/api/sponsors/:slug` response shape that Task 6 consumes — `tier: SponsorTierRef | null`, `editions: number[]` (years, descending), everything else unchanged.

- [ ] **Step 1: Port `GET /api/sponsors` — contract unchanged**

The query moves to the join; the response must stay identical. Replace the `prisma.sponsor.findMany` call with:

```ts
const links = await prisma.editionSponsor.findMany({
  where: { editionId: edition.id, publicationStatus: "PUBLISHED", sponsor: notDeleted },
  include: {
    sponsor: { select: { id: true, slug: true, name: true, logoUrl: true, websiteUrl: true } },
    tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
  },
});

return links
  .map((link) => ({
    id: link.sponsor.id,
    slug: link.sponsor.slug,
    name: link.sponsor.name,
    logoUrl: link.sponsor.logoUrl,
    tier: {
      key: link.tier.key,
      rank: link.tier.rank,
      nameFr: link.tier.nameFr,
      nameEn: link.tier.nameEn,
      logoScale: link.tier.logoScale,
      color: link.tier.color,
    },
    websiteUrl: link.sponsor.websiteUrl,
  }))
  // Higher rank = more prominent (RG-221), so sort descending.
  .sort((a, b) => (b.tier.rank - a.tier.rank) || a.name.localeCompare(b.name));
```

Note `id` is the **sponsor's** id, as before — not the participation's. The existing test asserts on sponsor ids.

- [ ] **Step 2: Port `GET /api/sponsors/:slug` — two independent resolutions**

This is the one deliberate shape change. Replace the whole handler body:

```ts
// The company, by global slug (#129). No featured-edition scope: a company
// page exists independently of whether it sponsors the current year.
const sponsor = await prisma.sponsor.findFirst({
  where: {
    slug: request.params.slug,
    ...notDeleted,
    // `edition: notDeleted` is required in BOTH positions, exactly as
    // speakers.ts does since #352: the route used to resolve
    // getFeaturedEdition(), which filtered the trash for free. Now that it
    // spans every year, a trashed edition would resurface — as a dead year tag
    // linking to a 404, or as a live page for a sponsor whose only
    // participations are in withdrawn editions.
    editions: { some: { publicationStatus: "PUBLISHED", edition: notDeleted } },
  },
  include: {
    // One query, not two: tier and jobOffers are read here rather than by a
    // second findUnique on the participation. The row is already being touched,
    // and a second read would open a skew window for no gain.
    editions: {
      where: { publicationStatus: "PUBLISHED", edition: notDeleted },
      select: {
        editionId: true,
        edition: { select: { year: true } },
        tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
        jobOffers: {
          select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { edition: { year: "desc" } },
    },
    // Nested reads need their own filter: a query extension would not reach
    // them (Prisma applies those to the top-level operation only).
    speakers: {
      where: { publicationStatus: "PUBLISHED", speaker: notDeleted },
      select: { speaker: { select: { slug: true, name: true, photoUrl: true, company: true } } },
      orderBy: { speaker: { name: "asc" } },
    },
  },
});

if (!sponsor) return reply.status(404).send({ error: "Sponsor not found" });

// The featured edition is resolved separately and drives the highlight only.
// Past years are tags: no tier, no offers (spec — "no past offer is ever
// shown", so there is no edition to choose when filtering).
const edition = await getFeaturedEdition();
const current = edition ? sponsor.editions.find((e) => e.editionId === edition.id) : undefined;

// `current` already carries the tier and the offers — no second query. Do NOT
// re-fetch the participation with findUnique: it reads a row the query above
// already touched, and a guard on its result would be unreachable (current is
// non-undefined only when that exact participation exists).
const tier = current
  ? {
      key: current.tier.key,
      rank: current.tier.rank,
      nameFr: current.tier.nameFr,
      nameEn: current.tier.nameEn,
      logoScale: current.tier.logoScale,
      color: current.tier.color,
    }
  : null;

// Offers disappear one month after the event (#251). `edition` is the featured
// one, the only edition whose offers may ever be shown.
const jobOffers = current && edition && areOffersVisible(edition) ? current.jobOffers : [];

return {
  id: sponsor.id,
  slug: sponsor.slug,
  name: sponsor.name,
  logoUrl: sponsor.logoUrl,
  tier,
  websiteUrl: sponsor.websiteUrl,
  descriptionFr: sponsor.descriptionFr,
  descriptionEn: sponsor.descriptionEn,
  socialLinks: parseSocial(sponsor.socialLinks),
  // Projected back to the pre-#353 shape: the payload must not change.
  speakers: sponsor.speakers.map((link) => link.speaker),
  jobOffers,
  // Year tags (#129), newest first. The frontend links them to /editions/<year>.
  editions: sponsor.editions.map((e) => e.edition.year),
};
```

- [ ] **Step 3: Port `GET /api/job-offers` — contract unchanged**

Only the query path changes. The `where` on `prisma.sponsor.findMany` moves onto the participation:

```ts
const sponsors = await prisma.sponsor.findMany({
  where: {
    ...notDeleted,
    editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED", jobOffers: { some: {} } } },
  },
  select: {
    slug: true,
    name: true,
    logoUrl: true,
    editions: {
      where: { editionId: edition.id },
      select: {
        jobOffers: {
          select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
          orderBy: { createdAt: "asc" },
        },
      },
    },
  },
  orderBy: { name: "asc" },
});
```

Then flatten so the emitted shape is unchanged — each item still carries a flat `jobOffers` array:

```ts
return sponsors.map((s) => ({
  slug: s.slug,
  name: s.name,
  logoUrl: s.logoUrl,
  jobOffers: s.editions.flatMap((e) => e.jobOffers),
}));
```

Read the existing handler before editing and preserve whatever ordering and filtering it already applies — this snippet shows the shape of the change, not a licence to drop existing behaviour.

- [ ] **Step 4: Write the new tests for the changed shape**

Append to `src/backend/src/__tests__/public-sponsors.test.ts`. These are new behaviour, so they must fail before Step 1–3 land — if you have already implemented, verify they pass and that mutating the expectation makes them fail.

```ts
describe("Sponsor detail spans editions (#129)", () => {
  it("serves a past-edition sponsor with no tier, and hides its offers", async () => {
    // Two past editions, newest first in the response: pins the sort order.
    // 176x is this file's block — every year stays below getSeededEdition()'s
    // 2016 floor so no parallel file can pick these up (#292).
    const older = await prisma.edition.create({ data: { year: 1760 } });
    const newer = await prisma.edition.create({ data: { year: 1761 } });
    const tierId = await tierIdByKey("gold");
    const sponsor = await createSponsorFixture({
      name: "Past Only Co",
      slug: `past-only-${Date.now()}`,
      editionId: older.id,
      tierId,
      publicationStatus: "PUBLISHED",
    });
    createdSponsorIds.push(sponsor.id);
    createdEditionIds.push(older.id, newer.id);

    await prisma.editionSponsor.create({
      data: { sponsorId: sponsor.id, editionId: newer.id, tierId, publicationStatus: "PUBLISHED" },
    });

    // An offer on a PAST participation. The governing rule is "no past offer is
    // ever shown", so this must not surface — asserting [] on a sponsor with no
    // offers at all would hold even with the filter removed.
    const pastParticipation = await prisma.editionSponsor.findUniqueOrThrow({
      where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId: newer.id } },
      select: { id: true },
    });
    await prisma.sponsorJobOffer.create({
      data: { editionSponsorId: pastParticipation.id, title: "Stale Job", url: "https://example.org/stale" },
    });

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: `/api/sponsors/${sponsor.slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Not sponsoring the featured edition: highlight is empty, history remains.
    expect(body.tier).toBeNull();
    expect(body.jobOffers).toEqual([]);
    // Newest first, exact — `toContain` would let a reversed sort pass.
    expect(body.editions).toEqual([1761, 1760]);
  });

  it("highlights the tier of the featured edition", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("platinum");
    const sponsor = await createSponsorFixture({
      name: "Current Co",
      slug: `current-${Date.now()}`,
      editionId: edition.id,
      tierId,
      publicationStatus: "PUBLISHED",
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: `/api/sponsors/${sponsor.slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // The WHOLE tier object, not just its key: rank, logoScale and color drive
    // the banner colour and logo size, so dropping one must fail the test.
    expect(body.tier).toMatchObject({
      key: "platinum",
      nameFr: expect.any(String),
      nameEn: expect.any(String),
      color: expect.any(String),
    });
    expect(typeof body.tier.rank).toBe("number");
    expect(typeof body.tier.logoScale).toBe("number");
    expect(body.editions).toContain(edition.year);
  });
});
```

Add `createdEditionIds` tracking and an `afterEach` edition cleanup to this file if it has none, following `sponsor-identity.test.ts`: delete sponsors first, then editions, both unconditionally. Years 1760 and 1761 sit in this file's 176x block, below `getSeededEdition()`'s 2016 floor, so parallel files cannot pick them up (#292).

- [ ] **Step 5: Port the existing fixtures in both test files**

In `public-sponsors.test.ts` and `sponsor-job-offers.test.ts`, replace every `prisma.sponsor.create({ data: { ..., editionId, tierId, publicationStatus } })` with `createSponsorFixture({ ... })` from Task 1. Job-offer creates move from `sponsorId` to `editionSponsorId` — resolve the participation first:

```ts
const participation = await prisma.editionSponsor.findUniqueOrThrow({
  where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId: edition.id } },
  select: { id: true },
});
await prisma.sponsorJobOffer.create({
  data: { editionSponsorId: participation.id, title: "Dev", url: "https://example.org/job" },
});
```

**Do not change any existing assertion** in these files except where the sponsor-detail shape genuinely changed (`tier`, `editions`). An assertion on `/api/sponsors` or `/api/job-offers` that stops passing means the port is wrong.

- [ ] **Step 6: Run both test files**

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm exec vitest run src/__tests__/public-sponsors.test.ts src/__tests__/sponsor-job-offers.test.ts
```

Expected: all pass.

- [ ] **Step 7: Search for tests encoding the old 404**

The 404 changed meaning: it no longer fires when there is no featured edition. Check nothing asserts the old behaviour:

```bash
grep -rn "Sponsor not found\|No edition found" src/__tests__/
```

For each hit, read the test and confirm it still describes reality. Report any that do not — do **not** silently rewrite an assertion to match new behaviour without saying so in your report.

- [ ] **Step 8: Commit**

```bash
git add src/backend/src/routes/sponsors.ts src/backend/src/__tests__/public-sponsors.test.ts src/backend/src/__tests__/sponsor-job-offers.test.ts
git commit -m "feat(sponsor): serve any edition's sponsor, highlight the current"
```

---

## Task 3: The four peripheral route files

Small, mechanical, and each independently verifiable. Grouped because no one of them is worth its own review gate.

**Files:**
- Modify: `src/backend/src/routes/speakers.ts`
- Modify: `src/backend/src/routes/editions.ts`
- Modify: `src/backend/src/routes/admin/editions.ts`
- Modify: `src/backend/src/routes/admin/sponsor-tiers.ts`
- Modify: `src/backend/src/__tests__/editions.test.ts`
- Modify: `src/backend/src/__tests__/speaker-edition-sponsor.test.ts`
- Modify: `src/backend/src/__tests__/admin-sponsor-tiers.test.ts`

- [ ] **Step 1: `speakers.ts` — publication of the employer, per year**

`GET /api/speakers/:slug` shows each participation's employer and hides it unless the sponsor is published. `publicationStatus` left the identity, so the question became "published for which year?" — **the year of that participation** (decided with the user). A sponsor in draft for 2019 must not surface on a 2019 card because it is published in 2026.

In the `editions` select, replace the `sponsor` select with one that carries that year's participation:

```ts
sponsor: {
  select: {
    slug: true,
    name: true,
    deletedAt: true,
    // Published for THIS year, not any year: the employer statement is dated
    // (#353), so its visibility must be too. A to-one relation takes no
    // `where` in a select, hence the filtered nested list.
    editions: { select: { editionId: true, publicationStatus: true } },
  },
},
```

Then rewrite the `sponsor:` projection in the returned `participations`:

```ts
sponsor: (() => {
  if (!link.sponsor || link.sponsor.deletedAt) return null;
  const thatYear = link.sponsor.editions.find((e) => e.editionId === link.editionId);
  return thatYear?.publicationStatus === "PUBLISHED"
    ? { slug: link.sponsor.slug, name: link.sponsor.name }
    : null;
})(),
```

This needs `editionId` in the outer `editions` select — add it next to `isFeatured` if absent.

- [ ] **Step 2: `editions.ts` — the public per-year sponsor query**

Around line 302 a `prisma.sponsor` query filters on `editionId`, and a `SponsorJobOffer` query filters on `sponsor`. Route both through the participation:

```ts
// sponsor count / list for the year
where: { ...notDeleted, editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } } }

// job offers of that year's participations
where: { editionSponsor: { editionId: edition.id, publicationStatus: "PUBLISHED", sponsor: notDeleted } }
```

Read the surrounding code and preserve its existing intent — these are the two `where` clauses to fix, not a rewrite of the handler.

- [ ] **Step 3: `admin/editions.ts` — the sponsor counter**

Two `_count` selects name `sponsors`, a relation `Edition` no longer has, and the readback uses `edition._count.sponsors`. The join is `editionSponsors`, and the trash now lives on the identity — so the filter matches the speakers/categories lines directly above:

```ts
// `editionSponsors` is the EditionSponsor join since #129, same as `speakers`
// and `categories`: the join row has no deletedAt, so the filter targets the
// company.
editionSponsors: { where: { sponsor: notDeleted } },
```

And at each readback site, `edition._count.sponsors` becomes `edition._count.editionSponsors`. **Keep the emitted field name `sponsorsCount`** — that is the admin API contract and the frontend reads it.

**The relation name also reaches an admin-facing string.** The DELETE handler builds its 409 message straight from the `_count` keys:

```ts
const blocking = Object.entries(existing._count)
  .filter(([, count]) => count > 0)
  .map(([relation, count]) => `${relation} (${count})`);
```

So renaming the relation silently changes what an organiser reads from "sponsors (12)" to "editionSponsors (12)" — a Prisma internal leaking into the UI. Map it back, scoped to this handler:

```ts
// The 409 message is built from relation keys, so a renamed relation would
// surface as "editionSponsors (12)". Label it for humans.
const RELATION_LABELS: Record<string, string> = { editionSponsors: "sponsors" };
```

and use `RELATION_LABELS[relation] ?? relation` in the `.map()`. Add a test asserting the 409 body says "sponsors" — nothing pinned this string before, which is exactly why the regression would have shipped silently.

- [ ] **Step 4: `admin/sponsor-tiers.ts` — the tier-in-use check**

Line ~143 asks whether any sponsor uses a tier, via `where: { tierId }` on `Sponsor`. The tier is on the participation now:

```ts
const inUse = await prisma.editionSponsor.count({ where: { tierId: Number(id) } });
```

Read the surrounding block: if it also filters on `notDeleted`, express it as `sponsor: notDeleted`.

- [ ] **Step 5: Port the three test files' fixtures**

`editions.test.ts`, `speaker-edition-sponsor.test.ts` and `admin-sponsor-tiers.test.ts` each build a sponsor with a flat `editionId`. Replace with `createSponsorFixture({ ... })` from Task 1. Change no assertion.

- [ ] **Step 6: Typecheck these four route files**

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm typecheck 2>&1 | grep -E "routes/(speakers|editions)\.ts|routes/admin/(editions|sponsor-tiers)\.ts"
```

Expected: empty.

- [ ] **Step 7: Run the affected tests**

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm exec vitest run src/__tests__/editions.test.ts src/__tests__/speaker-edition-sponsor.test.ts src/__tests__/admin-sponsor-tiers.test.ts src/__tests__/public-speaker-detail.test.ts
```

Expected: all pass. `public-speaker-detail.test.ts` is included deliberately — it covers the employer projection you changed in Step 1.

- [ ] **Step 8: Commit**

```bash
git add src/backend/src/routes/speakers.ts src/backend/src/routes/editions.ts src/backend/src/routes/admin/editions.ts src/backend/src/routes/admin/sponsor-tiers.ts src/backend/src/__tests__/editions.test.ts src/backend/src/__tests__/speaker-edition-sponsor.test.ts src/backend/src/__tests__/admin-sponsor-tiers.test.ts
git commit -m "fix(sponsor): date the employer and tier lookups per edition"
```

---

## Task 4: Admin sponsor endpoints

The largest task: 412 lines, 12 endpoints. Read the whole file before editing.

**Files:**
- Modify: `src/backend/src/routes/admin/sponsors.ts`
- Modify: `src/backend/src/__tests__/admin-sponsor-contacts.test.ts`
- Modify: `src/backend/src/__tests__/sponsor-contacts.test.ts`

**Interfaces:**
- Consumes: `createSponsorFixture` from Task 1.
- Produces: `POST /sponsors` answers **409** `{ error: "sponsor_exists", id: number }` when the slug is taken; `POST /sponsors/:id/editions` and `DELETE /sponsors/:id/editions/:editionId` attach/detach a participation.

- [ ] **Step 1: Split the request body types**

`SponsorCreateBody` mixes identity and participation. Make the split explicit so the handlers cannot confuse them:

```ts
// Identity — shared across every edition the company sponsors.
interface SponsorIdentityFields {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  socialLinks?: Record<string, string>;
  contactEmail?: string;
  locale?: string;
  standContacts?: StandContact[];
}

// Participation — bought or tracked for one edition (#129).
interface SponsorParticipationFields {
  tierId: number;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  comKitReceived?: boolean;
  comKitLogoWebUrl?: string;
  comKitLogoPrintUrl?: string;
  comKitCharterUrl?: string;
  comKitNotes?: string;
  platinumPromoIdea?: string;
  platinumCoBuildIdea?: string;
}

interface SponsorCreateBody extends SponsorIdentityFields, SponsorParticipationFields {
  editionId: number;
}

type SponsorUpdateBody = Partial<Omit<SponsorCreateBody, "editionId">> & { editionId?: number };
```

`SponsorUpdateBody` keeps an optional `editionId` so a `PUT` can say which participation its per-year fields target.

- [ ] **Step 2: `GET /sponsors` — one row per company**

The list currently filters `editionId` on `Sponsor` and orders by tier. Route it through the join and carry the participations, mirroring the admin speakers list:

```ts
const sponsors = await prisma.sponsor.findMany({
  where: {
    ...notDeleted,
    ...(editionId ? { editions: { some: { editionId: Number(editionId) } } } : {}),
  },
  include: {
    editions: {
      ...(editionId ? { where: { editionId: Number(editionId) } } : {}),
      select: {
        id: true,
        publicationStatus: true,
        edition: { select: { id: true, year: true } },
        tier: { select: { key: true, nameFr: true, nameEn: true, rank: true } },
      },
      orderBy: { edition: { year: "desc" } },
    },
  },
  orderBy: { name: "asc" },
});
```

Read what the current handler emits and keep the admin frontend's field names working. Where it emitted a flat `tier`/`publicationStatus`/`edition`, emit them from the participation the admin is looking at — the most recent one when no `editionId` filter is given.

**On the ordering:** the old handler sorted by tier rank descending, then name (RG-221). Sorting by name alone is the accepted behaviour here — a deliberate call, not an oversight: RG-221 governs how sponsors are *displayed to visitors*, and the public wall in `routes/sponsors.ts` still applies it. The admin list is a working list; filters and sort controls can come later if the need appears. Do not reintroduce the rank ordering.

- [ ] **Step 3: `GET /sponsors/:id` — identity plus its participations**

`include: { edition, tier, jobOffers }` no longer resolves. Replace with:

```ts
include: {
  editions: {
    select: {
      id: true,
      publicationStatus: true,
      comKitReceived: true,
      comKitLogoWebUrl: true,
      comKitLogoPrintUrl: true,
      comKitCharterUrl: true,
      comKitNotes: true,
      platinumPromoIdea: true,
      platinumCoBuildIdea: true,
      edition: { select: { id: true, year: true } },
      tier: { select: { key: true, nameFr: true, nameEn: true, rank: true } },
      jobOffers: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { edition: { year: "desc" } },
  },
},
```

- [ ] **Step 4: `POST /sponsors` — create identity + participation, 409 on a taken slug**

The slug is globally unique now, so `uniqueSlug` against a per-edition set is wrong: silently minting `acme-2` would recreate the duplicates #129 removed. Answer 409 and let the admin attach instead.

```ts
const slug = slugify(body.name);

// Globally unique since #129. A taken slug means the company already exists:
// offer to attach a participation rather than minting acme-2 and recreating
// the duplicates the model was changed to remove. Deliberately NOT filtered on
// deletedAt — a trashed company still owns its slug until purged.
const clash = await prisma.sponsor.findUnique({ where: { slug }, select: { id: true } });
if (clash) {
  return reply.code(409).send({ error: "sponsor_exists", id: clash.id });
}

const sponsor = await prisma.sponsor.create({
  include: {
    editions: {
      select: { id: true, edition: { select: { id: true, year: true } }, tier: { select: { key: true, nameFr: true, nameEn: true, rank: true } } },
    },
  },
  data: {
    slug,
    name: body.name.trim(),
    logoUrl: body.logoUrl || null,
    websiteUrl: body.websiteUrl || null,
    descriptionFr: sanitizeRichHtml(body.descriptionFr) || null,
    descriptionEn: sanitizeRichHtml(body.descriptionEn) || null,
    socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
    contactEmail: body.contactEmail || null,
    locale: normalizeLocale(body.locale),
    standContacts: body.standContacts?.length ? JSON.stringify(body.standContacts) : null,
    editions: {
      create: [{
        editionId: body.editionId,
        tierId: body.tierId,
        publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        comKitReceived: body.comKitReceived ?? false,
        comKitLogoWebUrl: body.comKitLogoWebUrl || null,
        comKitLogoPrintUrl: body.comKitLogoPrintUrl || null,
        comKitCharterUrl: body.comKitCharterUrl || null,
        comKitNotes: body.comKitNotes || null,
        platinumPromoIdea: body.platinumPromoIdea || null,
        platinumCoBuildIdea: body.platinumCoBuildIdea || null,
      }],
    },
  },
});
```

Keep the existing `400` on missing `editionId`/`name`/`tierId` and the `422` on an invalid `tierId`, both unchanged.

- [ ] **Step 5: `PUT /sponsors/:id` — identity fields vs participation fields**

Write identity fields on `Sponsor`, per-year fields on the participation. Resolve which participation from `body.editionId`, falling back to the most recent:

```ts
const target = body.editionId
  ? await prisma.editionSponsor.findUnique({
      where: { sponsorId_editionId: { sponsorId: id, editionId: body.editionId } },
      select: { id: true },
    })
  : await prisma.editionSponsor.findFirst({
      where: { sponsorId: id },
      orderBy: { edition: { year: "desc" } },
      select: { id: true },
    });
```

Then update each side only with the fields the body actually carries, preserving the existing "only touch what was sent" behaviour.

**Resolve `target` only when the body actually carries a per-year field.** An identity-only edit — renaming a company, swapping its logo — must succeed even on a sponsor with no participation at all; refusing it because no edition is attached yet would be nonsense. The `422` then fires exactly where it should: a per-year value was sent and there is no year to write it to.

- [ ] **Step 6: `POST /sponsors/bulk` — target participations**

The bulk status action sets `publicationStatus`, now on the participation. Require an `editionId` in the body so the action cannot silently touch editions the admin is not looking at (the guard #351 established for speakers):

```ts
interface SponsorBulkBody {
  ids: number[];
  action: "setStatus";
  value: "DRAFT" | "PUBLISHED";
  editionId: number;
}
```

```ts
if (!body.editionId) {
  return reply.code(400).send({ error: "editionId is required: status is per edition" });
}
const { count } = await prisma.editionSponsor.updateMany({
  // `sponsor: notDeleted` matters: without it a trashed company caught in a
  // bulk selection gets published. The sibling endpoint already guards this —
  // see admin/speakers.ts, `speaker: notDeleted` on its own bulk updateMany.
  where: { sponsorId: { in: body.ids }, editionId: body.editionId, sponsor: notDeleted },
  data: { publicationStatus: body.value },
});
```

Cover it with a test that bites: two sponsors on one edition, one trashed, bulk-publish both ids, assert the live one is `PUBLISHED` and the trashed one still `DRAFT`. Removing the guard must fail that test.

- [ ] **Step 7: Add attach / detach endpoints**

```ts
// POST /api/admin/sponsors/:id/editions — attach a participation (#129).
app.post<{ Params: SponsorIdParams; Body: { editionId: number; tierId: number } }>(
  "/sponsors/:id/editions",
  { schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
  async (request, reply) => {
    const sponsorId = Number(request.params.id);
    const { editionId, tierId } = request.body;
    if (!editionId || !tierId) {
      return reply.code(400).send({ error: "editionId and tierId are required" });
    }
    const participation = await prisma.editionSponsor.upsert({
      where: { sponsorId_editionId: { sponsorId, editionId } },
      create: { sponsorId, editionId, tierId, publicationStatus: "DRAFT" },
      update: { tierId },
      select: { id: true, editionId: true, tierId: true, publicationStatus: true },
    });
    revalidateSponsors();
    return participation;
  },
);

// DELETE /api/admin/sponsors/:id/editions/:editionId — detach a participation.
// The company itself survives: the trash operates on the identity.
app.delete<{ Params: SponsorIdParams & { editionId: string } }>(
  "/sponsors/:id/editions/:editionId",
  {
    schema: {
      params: {
        type: "object",
        required: ["id", "editionId"],
        properties: { id: { type: "string" }, editionId: { type: "string" } },
      },
    },
  },
  async (request, reply) => {
    const { count } = await prisma.editionSponsor.deleteMany({
      where: { sponsorId: Number(request.params.id), editionId: Number(request.params.editionId) },
    });
    if (!count) return notFound(reply, "Participation not found");
    revalidateSponsors();
    return reply.code(204).send();
  },
);
```

- [ ] **Step 8: Leave the contact endpoints alone**

`/contacts`, `/contacts/:contactId/resend`, `/lock`, and the contact `DELETE` operate on `SponsorContact`, which stayed on the identity. If one of them fails to typecheck, it is because of a shared helper — fix that, not the endpoint's logic.

- [ ] **Step 9: Port the two contact test files**

`admin-sponsor-contacts.test.ts` and `sponsor-contacts.test.ts` build sponsors with a flat `editionId`. Use `createSponsorFixture`. Change no assertion — contact behaviour did not change.

- [ ] **Step 10: Typecheck and run the admin tests**

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm typecheck 2>&1 | grep "admin/sponsors"
```
Expected: empty.

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm exec vitest run src/__tests__/admin-sponsor-contacts.test.ts src/__tests__/sponsor-contacts.test.ts
```
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src/backend/src/routes/admin/sponsors.ts src/backend/src/__tests__/admin-sponsor-contacts.test.ts src/backend/src/__tests__/sponsor-contacts.test.ts
git commit -m "feat(admin): edit a sponsor identity and its participations"
```

---

## Task 5: Magic-link sponsor editing

**Files:**
- Modify: `src/backend/src/routes/edit.ts`
- Modify: `src/backend/src/__tests__/edit-sponsor-platinum.test.ts`
- Modify: `src/backend/src/__tests__/edit-sponsor-private.test.ts`
- Modify: `src/backend/src/__tests__/edit-sponsor-description.test.ts`
- Modify: `src/backend/src/__tests__/edit-social-bluesky.test.ts`
- Modify: `src/backend/src/__tests__/edit-upload.test.ts`
- Modify: `src/backend/src/__tests__/edit-talk-update.test.ts`

**Interfaces:**
- Consumes: `createSponsorWithToken` from Task 1.

- [ ] **Step 1: Understand what does and does not change**

The token still resolves on `SponsorContact` → `Sponsor` (identity), untouched since #250. What breaks is the **fields** the handler reads and writes: `platinumPromoIdea`, `comKit*` and `publicationStatus` moved to the participation, while `logoUrl`, descriptions, `socialLinks` and `standContacts` stayed on the identity.

Read the sponsor branch of `edit.ts` (around lines 310 and 561) and classify every field it touches against that split before editing.

- [ ] **Step 2: Resolve the editable participation**

A sponsor editing its page edits the **current** edition — that is what the link is for. Resolve the featured edition's participation once, next to where the contact is resolved:

```ts
// Per-year fields live on the participation since #129. A modification link
// edits the current edition: that is the year the sponsor was contacted about.
const edition = await getFeaturedEdition();
const participation = edition
  ? await prisma.editionSponsor.findUnique({
      where: { sponsorId_editionId: { sponsorId: entity.id, editionId: edition.id } },
      select: { id: true, platinumPromoIdea: true, platinumCoBuildIdea: true, comKitReceived: true, comKitLogoWebUrl: true, comKitLogoPrintUrl: true, comKitCharterUrl: true, comKitNotes: true, tier: { select: { key: true } } },
    })
  : null;
```

- [ ] **Step 3: Read and write the per-year fields through the participation**

Where the GET projected `sponsor.platinumPromoIdea` / `comKit*`, read them from `participation`. Where the PUT wrote them via `prisma.sponsor.update`, write them with `prisma.editionSponsor.update({ where: { id: participation.id }, data: { ... } })`. Identity fields keep using `prisma.sponsor.update`.

The Platinum block is conditional on the tier (#252): read the tier from `participation.tier.key`, not from the sponsor.

If `participation` is null — no featured edition, or the company does not sponsor it — the per-year fields read as empty and a write to them answers `422`. There is no year to write to, and silently writing to last year's participation would be worse.

- [ ] **Step 4: Port the six test files' fixtures**

All six call `createSponsorWithToken` with a flat `editionId`/`tierId`, which Task 1's `SponsorFixture` already accepts — most will need no change beyond removing an explicit `Prisma.SponsorUncheckedCreateInput` annotation if one is present. Where a test asserts on a per-year field, it must now create the participation on the **featured** edition for the handler to find it.

Change assertions only where the per-year/identity split genuinely moved the behaviour, and say so in your report.

- [ ] **Step 5: Typecheck and run the edit tests**

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm typecheck 2>&1 | grep "routes/edit.ts"
```
Expected: empty.

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm exec vitest run src/__tests__/edit-sponsor-platinum.test.ts src/__tests__/edit-sponsor-private.test.ts src/__tests__/edit-sponsor-description.test.ts src/__tests__/edit-social-bluesky.test.ts src/__tests__/edit-upload.test.ts src/__tests__/edit-talk-update.test.ts
```
Expected: all pass.

- [ ] **Step 6: Full backend suite**

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm typecheck
```
Expected: **clean, zero errors.** This is the moment the backend is whole again.

```bash
DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest" pnpm test
```
Expected: every test passes. If a test outside the sponsor area fails, stop and report — it means the port reached further than intended.

- [ ] **Step 7: Commit**

```bash
git add src/backend/src/routes/edit.ts src/backend/src/__tests__/edit-sponsor-platinum.test.ts src/backend/src/__tests__/edit-sponsor-private.test.ts src/backend/src/__tests__/edit-sponsor-description.test.ts src/backend/src/__tests__/edit-social-bluesky.test.ts src/backend/src/__tests__/edit-upload.test.ts src/backend/src/__tests__/edit-talk-update.test.ts
git commit -m "feat(edit): sponsor per-year fields live on the participation"
```

---

## Task 6: The public sponsor page

Pulled into #130 rather than left to #132: the contract changes here, so the consumer changes with it.

**A correction to the spec's premise, verified before writing this task:** the page **never reads `sponsor.tier`**. It renders `name`, `logoUrl`, the descriptions, `speakers` and `jobOffers` — no tier block exists today. So making `tier` nullable breaks nothing, and the "broken in-between state" the spec worried about does not arise. The real work here is the type change plus the new year tags.

That also means the tier is currently shown **only** on the sponsor wall (`/api/sponsors`), which is exactly where the spec's temporal rule says it belongs. No tier UI needs adding or guarding.

**Files:**
- Modify: `src/frontend/src/lib/types.ts`
- Modify: `src/frontend/src/app/[locale]/sponsors/[slug]/page.tsx`

**Interfaces:**
- Consumes: the `/api/sponsors/:slug` shape from Task 2 — `tier: SponsorTierRef | null`, `editions: number[]`.

- [ ] **Step 1: Update the contract**

In `src/frontend/src/lib/types.ts`, `interface SponsorDetail`:

```ts
  // Null unless the company sponsors the featured edition (#129): the tier is
  // a per-year fact. Shown on the sponsor wall, not on this page.
  tier: SponsorTierRef | null;
  // Years the company sponsored, newest first. Rendered as tags linking to
  // each edition's page.
  editions: number[];
```

- [ ] **Step 2: Confirm the page needs no tier guard**

```bash
grep -n "tier" "src/frontend/src/app/[locale]/sponsors/[slug]/page.tsx"
```

Expected: **no output.** If this prints anything, the file changed since this plan was written — guard each use with the file's existing `{cond && (...)}` style, and say so in your report. Do not invent a placeholder like "Ancien sponsor": absence of a tier means absence of a tier block.

- [ ] **Step 3: Render the year tags**

Add a tag list for `sponsor.editions`, each linking to that edition. Use the localized `Link` from `@/i18n/navigation` (not `next/link`) — the routes are locale-prefixed:

```tsx
{sponsor.editions.length > 0 && (
  <ul className="mt-6 flex flex-wrap gap-2">
    {sponsor.editions.map((year) => (
      <li key={year}>
        <Link
          href={`/editions/${year}`}
          className="rounded-[12px] bg-blanc-casse px-3 py-1 text-sm text-gris hover:text-noir transition-colors"
        >
          {year}
        </Link>
      </li>
    ))}
  </ul>
)}
```

Match the surrounding file's Tailwind vocabulary — reuse its existing colour and radius tokens rather than the ones above if they differ. The project uses `rounded-[12px]` for all-corner radius (`rounded-s` is logical/start-side only in Tailwind v4).

- [ ] **Step 4: Typecheck, lint and build the frontend**

From `src/frontend`:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/lib/types.ts "src/frontend/src/app/[locale]/sponsors/[slug]/page.tsx"
git commit -m "feat(sponsors): show the current tier, past years as tags"
```

---

## Verification Before Opening the PR

Run these and paste the real output into the PR description. Do not claim a step passed without having run it.

- [ ] Backend `pnpm typecheck` — **zero errors**
- [ ] Backend `pnpm test` — every test passes
- [ ] Frontend `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` — clean
- [ ] `pnpm exec tsx prisma/seed-dev.ts` twice in a row — both clean, sponsor counts stable
- [ ] Browser check on the local Docker stack (`.claude/rules/testing.md` step 3), via Chrome DevTools MCP:
  - `/fr/sponsors` — the wall renders, grouped by tier, unchanged from before
  - `/fr/sponsors/<slug>` for a **current** sponsor — tier highlighted, offers listed if any
  - `/fr/sponsors/<slug>` for a **past-only** sponsor — no tier block, year tags present and clickable
  - `/fr/offres-emploi-partenaires` — unchanged
  - `/fr/admin/sponsors` — list renders, one row per company
  - console clean on each

The browser pass is not optional: three of these behaviours (nullable tier, year tags, admin list) have no automated coverage of their rendering.

---

## Status

_Filled in during execution._
