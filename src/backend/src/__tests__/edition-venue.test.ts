import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import adminEditionRoutes from "../routes/admin/editions.js";
import editionRoutes from "../routes/editions.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// Venue & practical-info fields (#109): the admin PUT persists them and
// sanitizes the rich-text ones, and the public /editions/current exposes them.
// The tests edit a seeded edition, so they restore the fields afterwards.

async function buildAdminApp() {
  const app = Fastify({ logger: false });
  await app.register(adminEditionRoutes, { prefix: "/api/admin" });
  return app;
}

async function buildPublicApp() {
  const app = Fastify({ logger: false });
  await app.register(editionRoutes, { prefix: "/api" });
  return app;
}

let touchedEditionId: number | null = null;

afterEach(async () => {
  // Clear the venue fields this test wrote so seeded editions go back to their
  // original (empty) state — no leftover across runs.
  if (touchedEditionId !== null) {
    await prisma.edition.update({
      where: { id: touchedEditionId },
      data: {
        venueLat: null,
        venueLng: null,
        venueTransports: null,
        venueParking: null,
        venueDirectionsUrl: null,
      },
    });
    touchedEditionId = null;
  }
});

describe("edition venue fields (#109)", () => {
  it("persists coordinates and directions through the admin PUT", async () => {
    const edition = await getSeededEdition();
    touchedEditionId = edition.id;
    const app = await buildAdminApp();

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${edition.id}`,
      payload: {
        venueLat: 43.5497,
        venueLng: 1.5119,
        venueDirectionsUrl: "https://maps.example.com/route",
      },
    });
    expect(res.statusCode).toBe(200);

    const stored = await prisma.edition.findUnique({ where: { id: edition.id } });
    expect(stored?.venueLat).toBe(43.5497);
    expect(stored?.venueLng).toBe(1.5119);
    expect(stored?.venueDirectionsUrl).toBe("https://maps.example.com/route");

    await app.close();
  });

  it("sanitizes the rich-text transports/parking on write", async () => {
    const edition = await getSeededEdition();
    touchedEditionId = edition.id;
    const app = await buildAdminApp();

    await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${edition.id}`,
      payload: {
        venueTransports: '<p>Métro B</p><script>alert(1)</script>',
        venueParking: '<p>Parking Diagora</p>',
      },
    });

    const stored = await prisma.edition.findUnique({ where: { id: edition.id } });
    // The paragraph survives, the script is stripped by sanitizeRichHtml.
    expect(stored?.venueTransports).toContain("Métro B");
    expect(stored?.venueTransports).not.toContain("<script");
    expect(stored?.venueParking).toContain("Parking Diagora");

    await app.close();
  });

  it("exposes venue fields and hasVenueInfo on /editions/current", async () => {
    const edition = await getSeededEdition();
    touchedEditionId = edition.id;
    // The seed points featured_edition_id at the latest seeded edition, which is
    // exactly what getSeededEdition returns — so /current returns this row.
    // (Guarded below rather than assumed, so a seed change fails loudly.)
    await prisma.edition.update({
      where: { id: edition.id },
      data: { venueLat: 43.5, venueLng: 1.5, venueTransports: "<p>Bus</p>" },
    });

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/current" });
    const body = res.json();

    expect(body.id).toBe(edition.id); // guards the assumption above
    expect(body.hasVenueInfo).toBe(true);
    expect(body.venueLat).toBe(43.5);
    expect(body.venueTransports).toContain("Bus");

    await app.close();
  });
});
