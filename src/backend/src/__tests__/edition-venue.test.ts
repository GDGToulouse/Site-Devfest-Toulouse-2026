import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import adminVenueRoutes from "../routes/admin/venues.js";
import editionRoutes from "../routes/editions.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// Venue & practical-info fields (#109), now carried by the Venue entity (#105).
// Two things are under test here:
//
//   1. the admin writes them on the venue, and sanitizes the rich-text ones;
//   2. the PUBLIC payload still exposes them flattened onto the edition.
//
// (2) is the contract that let #105 land without touching the nine frontend
// files that read `edition.venueName` & co. If it breaks, the homepage strap
// line and /lieu go blank in production without a single type error.

async function buildAdminApp() {
  const app = Fastify({ logger: false });
  await app.register(adminVenueRoutes, { prefix: "/api/admin" });
  return app;
}

async function buildPublicApp() {
  const app = Fastify({ logger: false });
  await app.register(editionRoutes, { prefix: "/api" });
  return app;
}

let touchedVenueId: number | null = null;

afterEach(async () => {
  // Clear what the test wrote so the seeded venue goes back to its original
  // (empty) state — no leftover across runs.
  if (touchedVenueId !== null) {
    await prisma.venue.update({
      where: { id: touchedVenueId },
      data: { lat: null, lng: null, transports: null, parking: null, directionsUrl: null },
    });
    touchedVenueId = null;
  }
});

/** The venue of the most recent seeded edition. */
async function getSeededVenue() {
  const edition = await getSeededEdition();
  if (!edition.venueId) throw new Error("seed missing a venue on its latest edition");
  const venue = await prisma.venue.findUnique({ where: { id: edition.venueId } });
  if (!venue) throw new Error("seed venue not found");
  return venue;
}

describe("venue fields (#109 on the #105 model)", () => {
  it("persists coordinates and directions through the admin PUT", async () => {
    const venue = await getSeededVenue();
    touchedVenueId = venue.id;
    const app = await buildAdminApp();

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/venues/${venue.id}`,
      payload: { lat: 43.5497, lng: 1.5119, directionsUrl: "https://maps.example.com/route" },
    });
    expect(res.statusCode).toBe(200);

    const stored = await prisma.venue.findUnique({ where: { id: venue.id } });
    expect(stored?.lat).toBe(43.5497);
    expect(stored?.lng).toBe(1.5119);
    expect(stored?.directionsUrl).toBe("https://maps.example.com/route");

    await app.close();
  });

  it("rejects a javascript: directions URL rather than storing an XSS vector", async () => {
    const venue = await getSeededVenue();
    touchedVenueId = venue.id;
    const app = await buildAdminApp();

    // The URL ends up in an href on the public /lieu page. A javascript: scheme
    // must be refused at write time, not stored (#109 security follow-up).
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/venues/${venue.id}`,
      // eslint-disable-next-line no-script-url
      payload: { directionsUrl: "javascript:alert(document.cookie)" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("invalid_venue");

    // Nothing was written.
    const stored = await prisma.venue.findUnique({ where: { id: venue.id } });
    expect(stored?.directionsUrl).toBeNull();

    await app.close();
  });

  it("sanitizes the rich-text transports/parking on write", async () => {
    const venue = await getSeededVenue();
    touchedVenueId = venue.id;
    const app = await buildAdminApp();

    await app.inject({
      method: "PUT",
      url: `/api/admin/venues/${venue.id}`,
      payload: {
        transports: "<p>Métro B</p><script>alert(1)</script>",
        parking: "<p>Parking Diagora</p>",
      },
    });

    const stored = await prisma.venue.findUnique({ where: { id: venue.id } });
    // The paragraph survives, the script is stripped by sanitizeRichHtml.
    expect(stored?.transports).toContain("Métro B");
    expect(stored?.transports).not.toContain("<script");
    expect(stored?.parking).toContain("Parking Diagora");

    await app.close();
  });

  it("refuses to delete a venue an edition still points at", async () => {
    const venue = await getSeededVenue();
    const app = await buildAdminApp();

    const res = await app.inject({ method: "DELETE", url: `/api/admin/venues/${venue.id}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("venue_in_use");

    // Still there — a refused delete must not half-apply.
    expect(await prisma.venue.findUnique({ where: { id: venue.id } })).not.toBeNull();

    await app.close();
  });
});

describe("the public edition payload keeps its flat venue shape (#105)", () => {
  it("exposes venue fields and hasVenueInfo on /editions/current", async () => {
    const edition = await getSeededEdition();
    const venue = await getSeededVenue();
    touchedVenueId = venue.id;

    await prisma.venue.update({
      where: { id: venue.id },
      data: { lat: 43.5, lng: 1.5, transports: "<p>Bus</p>" },
    });

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/current" });
    const body = res.json();

    // The seed points featured_edition_id at the latest seeded edition, which
    // is what getSeededEdition returns. Guarded rather than assumed, so a seed
    // change fails loudly.
    expect(body.id).toBe(edition.id);

    // Flat keys, exactly as before the venue moved to its own table.
    expect(body.venueName).toBe(venue.name);
    expect(body.venueAddress).toBe(venue.address);
    expect(body.venueLat).toBe(43.5);
    expect(body.venueLng).toBe(1.5);
    expect(body.venueTransports).toContain("Bus");
    expect(body.hasVenueInfo).toBe(true);

    await app.close();
  });

  it("reports no venue info when the edition has no venue at all", async () => {
    // An edition detached from every venue must not crash the payload — it has
    // to answer null on each key, which is what the pages already handle.
    //
    // 1870 because `Edition.year` is @unique and the files run in parallel:
    // 1990 belongs to admin-edition-sponsor-tiers, 16xx/17xx/19xx to the
    // sponsor and speaker fixtures. Reusing one is the #292 failure, and it
    // only shows in the full run.
    const edition = await prisma.edition.create({
      data: { year: 1870, status: "PREPARATION" },
    });

    try {
      const app = await buildPublicApp();
      const res = await app.inject({ method: "GET", url: `/api/editions/${edition.year}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().venueName).toBeNull();
      expect(res.json().venueAddress).toBeNull();
      await app.close();
    } finally {
      await prisma.edition.delete({ where: { id: edition.id } });
    }
  });
});
