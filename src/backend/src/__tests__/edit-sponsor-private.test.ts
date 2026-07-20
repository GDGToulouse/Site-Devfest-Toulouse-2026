import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { buildEditApp } from "./test-edit-app.js";
import { buildPublicApp } from "./test-public-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorWithToken } from "./sponsor-test-helpers.js";

// Sponsor private fields (#249): editable via the magic link, visible in the
// admin, but NEVER exposed on any public route.

const TOKEN = "test-sponsor-private-token-0f1e2d3c4b5a6978";
let editionId: number;
let sponsorId: number;
let slug: string;

describe("Sponsor private section (#249)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    editionId = edition.id;
    slug = `private-test-sponsor-${Date.now()}`;

    const sponsor = await createSponsorWithToken({
      name: "Private Test Sponsor", slug, editionId, level: "GOLD",
      publicationStatus: "PUBLISHED", contactEmail: "sponsor@example.org",
    }, TOKEN, { email: "sponsor@example.org" });
    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
  });

  it("accepts and persists private fields via the magic link", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}`,
      payload: {
        standContacts: [{ name: "Alice", linkedin: "https://linkedin.com/in/alice" }, {}],
        comKitReceived: true,
        comKitLogoWebUrl: "https://example.org/logo-web.png",
        comKitNotes: "Charte à venir",
      },
    });
    expect(res.statusCode).toBe(200);

    const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
    expect(sponsor?.comKitReceived).toBe(true);
    expect(sponsor?.comKitLogoWebUrl).toBe("https://example.org/logo-web.png");
    // The empty contact row is dropped; only Alice remains.
    const stand = JSON.parse(sponsor?.standContacts ?? "[]");
    expect(stand).toHaveLength(1);
    expect(stand[0].name).toBe("Alice");
    await app.close();
  });

  it("returns the private block to the token holder (GET)", async () => {
    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.private).toBeDefined();
    expect(body.private.comKitReceived).toBe(true);
    expect(body.private.level).toBe("GOLD");
    await app.close();
  });

  it("exposes the sponsoring contact address so the UI can build a mailto (#271)", async () => {
    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}` });
    expect(res.statusCode).toBe(200);
    // A non-empty address the client turns into a mailto: link for complements.
    expect(typeof res.json().private.sponsorContactEmail).toBe("string");
    expect(res.json().private.sponsorContactEmail.length).toBeGreaterThan(0);
    await app.close();
  });

  it("rejects an unsafe URL in a stand contact", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}`,
      payload: { standContacts: [{ name: "Bob", linkedin: "javascript:alert(1)" }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_url");
    await app.close();
  });

  it("NEVER exposes private fields on the public sponsor route", async () => {
    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: `/api/sponsors/${slug}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // The public payload is an explicit allowlist — private keys must be absent.
    expect(body).not.toHaveProperty("standContacts");
    expect(body).not.toHaveProperty("comKitReceived");
    expect(body).not.toHaveProperty("comKitNotes");
    expect(body).not.toHaveProperty("private");
    expect(body).not.toHaveProperty("contactEmail");
    await app.close();
  });
});
