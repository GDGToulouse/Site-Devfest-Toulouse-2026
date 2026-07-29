import { describe, it, expect, afterEach } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// Below the seeded range (2016+, #292) so a parallel file can never pick this
// edition up as "the most recent one" mid-test.
const createdEditionIds: number[] = [];

afterEach(async () => {
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

describe("Admin Editions API", () => {
  it("GET /api/admin/editions should list editions", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/editions" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("year");
    expect(body[0]).toHaveProperty("status");
    await app.close();
  });

  it("GET /api/admin/editions/current should return current edition", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/editions/current" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("year");
    expect(body).toHaveProperty("status");
    await app.close();
  });

  it("PUT /api/admin/editions/:id should update edition", async () => {
    const app = await buildAdminApp();
    // Get current edition first
    const listRes = await app.inject({ method: "GET", url: "/api/admin/editions" });
    const editions = listRes.json();
    const edition = editions[0];

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${edition.id}`,
      payload: { status: edition.status }, // Same status, just test the endpoint
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("id", edition.id);
    await app.close();
  });

  // #164: an icon the site cannot render used to be accepted and then silently
  // displayed as nothing.
  it("PUT key-figures rejects an unknown icon without touching existing rows", async () => {
    const app = await buildAdminApp();
    const editions = (await app.inject({ method: "GET", url: "/api/admin/editions" })).json();
    const editionId = editions[0].id;

    const before = (await app.inject({
      method: "GET",
      url: `/api/admin/editions/${editionId}/key-figures`,
    })).json();

    const rejected = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${editionId}/key-figures`,
      payload: [{ icon: "user", value: "1", labelFr: "Test", labelEn: "Test" }],
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json().error).toContain("user");

    // Validation runs before the delete-and-recreate, so nothing was lost.
    const after = (await app.inject({
      method: "GET",
      url: `/api/admin/editions/${editionId}/key-figures`,
    })).json();
    expect(after).toEqual(before);

    await app.close();
  });

  it("PUT key-figures accepts a catalogue icon and an empty one", async () => {
    const app = await buildAdminApp();
    const editions = (await app.inject({ method: "GET", url: "/api/admin/editions" })).json();
    const editionId = editions[0].id;

    const before = (await app.inject({
      method: "GET",
      url: `/api/admin/editions/${editionId}/key-figures`,
    })).json();

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${editionId}/key-figures`,
      payload: [
        { icon: "rocket", value: "42", labelFr: "Fusées", labelEn: "Rockets" },
        { icon: "", value: "7", labelFr: "Sans icône", labelEn: "No icon" },
      ],
    });
    expect(res.statusCode).toBe(200);

    // Restore what the seed provided, so other tests see the original data.
    await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${editionId}/key-figures`,
      payload: before.map((f: { icon: string; value: string; labelFr: string; labelEn: string }) => ({
        icon: f.icon, value: f.value, labelFr: f.labelFr, labelEn: f.labelEn,
      })),
    });
    await app.close();
  });

  // The 409 body is admin-facing text, not a Prisma internal: `editionSponsors`
  // is the join's relation name since #129, but an organiser reading the
  // refusal should see "sponsors", not the schema's own vocabulary.
  it("DELETE refuses with a human label, not the Prisma relation name", async () => {
    const edition = await prisma.edition.create({ data: { year: 1850, status: "SEE_YOU_NEXT_YEAR" } });
    createdEditionIds.push(edition.id);
    await createSponsorFixture({
      name: "Blocking Sponsor",
      slug: `blocking-sponsor-${Date.now()}`,
      editionId: edition.id,
      tierId: await tierIdByKey("gold"),
    });

    const app = await buildAdminApp();
    const res = await app.inject({ method: "DELETE", url: `/api/admin/editions/${edition.id}` });
    await app.close();

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("sponsors (1)");
    expect(res.json().error).not.toContain("editionSponsors");
  });
});
