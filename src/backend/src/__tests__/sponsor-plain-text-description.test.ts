process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// #661 — a description sent as plain text (the API, the MCP connector, the
// history import) reached the page escaped twice: "Cloud &amp;amp; DevOps". The
// public API must hand the page HTML in which the ampersand is escaped once.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-admin", email: "admin@test.local", name: "Ad", role: "ADMIN" } },
}));

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

const { buildServer } = await import("../server.js");
const { prisma } = await import("../lib/prisma.js");
const { tierIdByKey } = await import("./sponsor-test-helpers.js");

const TEST_YEAR = 1570;
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
let app: FastifyInstance;
let editionId: number;
let tierId: number;
const sponsorIds: number[] = [];

async function createPublishedSponsor(payload: Record<string, unknown>) {
  const name = `Plain Text ${stamp} ${sponsorIds.length}`;
  const res = await app.inject({ method: "POST", url: "/api/admin/sponsors", payload: { name, editionId, tierId, ...payload } });
  const created = res.json();
  sponsorIds.push(created.id);
  await prisma.editionSponsor.updateMany({ where: { sponsorId: created.id }, data: { publicationStatus: "PUBLISHED" } });
  return created as { id: number; slug: string };
}

const publicPage = async (slug: string) => (await app.inject({ method: "GET", url: `/api/sponsors/${slug}` })).json();

beforeAll(async () => {
  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR } })).id;
  tierId = await tierIdByKey("discovery");
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.sponsor.deleteMany({ where: { id: { in: sponsorIds } } });
  await prisma.edition.deleteMany({ where: { id: editionId } });
});

describe("Sponsor description sent as plain text (#661)", () => {
  it("should reach the public page with its ampersand escaped once, in French and in English", async () => {
    const sponsor = await createPublishedSponsor({ descriptionFr: "Cloud & DevOps", descriptionEn: "R&D and Cloud" });

    const page = await publicPage(sponsor.slug);

    expect(page.descriptionFr).toBe("<p>Cloud &amp; DevOps</p>");
    expect(page.descriptionEn).toBe("<p>R&amp;D and Cloud</p>");
  });

  it("should do the same when the description is edited", async () => {
    const sponsor = await createPublishedSponsor({});

    await app.inject({ method: "PUT", url: `/api/admin/sponsors/${sponsor.id}`, payload: { descriptionFr: "a < b & c > d" } });

    expect((await publicPage(sponsor.slug)).descriptionFr).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });

  it("should still neutralise a script slipped into the text", async () => {
    const sponsor = await createPublishedSponsor({ descriptionFr: "Cloud & DevOps <script>alert(1)</script>" });

    const page = await publicPage(sponsor.slug);

    expect(page.descriptionFr).not.toContain("<script");
    expect(page.descriptionFr).not.toContain("alert(1)");
  });
});
