import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// The com-kit email endpoint sends mail; stub SMTP. Must be hoisted above imports.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import { buildEditApp } from "./test-edit-app.js";
import { buildPublicApp } from "./test-public-app.js";
import { prisma } from "../lib/prisma.js";

// Sponsor private fields (#249): editable via the magic link, visible in the
// admin, but NEVER exposed on any public route.

const TOKEN = "test-sponsor-private-token-0f1e2d3c4b5a6978";
let editionId: number;
let sponsorId: number;
let slug: string;

describe("Sponsor private section (#249)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirst({ orderBy: { year: "desc" } });
    if (!edition) throw new Error("seed missing an edition");
    editionId = edition.id;
    slug = `private-test-sponsor-${Date.now()}`;

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Private Test Sponsor", slug, editionId, level: "GOLD",
        editToken: TOKEN, editTokenSentAt: new Date(), publicationStatus: "PUBLISHED",
        contactEmail: "sponsor@example.org",
      },
    });
    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
  });

  beforeEach(() => sendMailMock.mockClear());

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

  it("sends a com-kit complement email to the sponsoring team", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/edit/${TOKEN}/com-kit-email`,
      payload: { message: "J'ai un PDF de charte à envoyer." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: true });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    // Reply-To points back to the sponsor so the orga can ask for the files.
    expect(sendMailMock.mock.calls[0][0].replyTo).toBe("sponsor@example.org");
    await app.close();
  });
});
