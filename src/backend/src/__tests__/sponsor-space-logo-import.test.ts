process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";

// The remote site is faked; fetchRemoteFile is tested on its own.
const fetchRemoteFile = vi.fn();
vi.mock("../lib/safe-fetch.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/safe-fetch.js")>()),
  fetchRemoteFile: (...args: unknown[]) => fetchRemoteFile(...args),
}));

const { default: sponsorSpaceRoutes } = await import("../routes/sponsor-space.js");
const { prisma } = await import("../lib/prisma.js");
const { UPLOADS_DIR } = await import("../lib/image-store.js");
const { RemoteFetchError } = await import("../lib/safe-fetch.js");
const { generateApiKey, resolveApiKeyEnv } = await import("../lib/api-key.js");
const { getSeededEdition } = await import("./edition-test-helpers.js");
const { createSponsorFixture, tierIdByKey } = await import("./sponsor-test-helpers.js");

// #687 — a logo saved as a third-party URL from the sponsor space: the share
// card only embeds /uploads/ images, and the host can change or drop the file.
// The backend imports it and saves the local path, on the company and on the
// year's participation alike (#375).

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

let app: FastifyInstance;
let editionId: number;
let sponsorId: number;
let editorAuth: string;
const created = { userIds: [] as string[], sponsorIds: [] as number[] };
const written: string[] = [];

beforeAll(async () => {
  const edition = await getSeededEdition();
  editionId = edition.id;

  const suffix = `${Date.now()}`;
  const sponsor = await createSponsorFixture({
    name: `Logo Import Co ${suffix}`,
    slug: `logo-import-co-${suffix}`,
    editionId,
    tierId: await tierIdByKey("gold"),
  });
  sponsorId = sponsor.id;
  created.sponsorIds.push(sponsor.id);

  const email = `logo-import-editor-${suffix}@example.org`;
  const user = await prisma.user.create({ data: { email, name: email, role: "SPONSOR", emailVerified: true } });
  created.userIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  await prisma.sponsorContact.create({ data: { sponsorId, email, userId: user.id, accessRole: "EDITEUR" } });
  editorAuth = `Bearer ${key.raw}`;

  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });
  await app.ready();
});

afterEach(() => {
  fetchRemoteFile.mockReset();
});

afterAll(async () => {
  await app.close();
  for (const name of written.splice(0)) {
    await fs.promises.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});
    await prisma.fileMetadata.deleteMany({ where: { filename: name } });
  }
  if (created.userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
  if (created.sponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  }
});

function save(body: Record<string, unknown>) {
  return app.inject({
    method: "PUT",
    url: `/api/sponsor-space/${sponsorId}`,
    payload: body,
    headers: { authorization: editorAuth },
  });
}

async function storedLogos() {
  const sponsor = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsorId }, select: { logoUrl: true } });
  const participation = await prisma.editionSponsor.findFirstOrThrow({
    where: { sponsorId, editionId },
    select: { logoUrl: true },
  });
  return { identity: sponsor.logoUrl, year: participation.logoUrl };
}

describe("PUT /api/sponsor-space/:sponsorId — logo given as a URL (#687)", () => {
  it("should save an imported /uploads/ copy on the company and on the year", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>';
    fetchRemoteFile.mockResolvedValue({ buffer: Buffer.from(svg), url: new URL("https://brand.example.org/logo.svg") });

    const res = await save({ logoUrl: "https://brand.example.org/logo.svg" });

    expect(res.statusCode).toBe(200);
    const { identity, year } = await storedLogos();
    expect(identity).toMatch(/^\/uploads\/.+\.svg$/);
    expect(year).toBe(identity);
    expect(res.json()).toMatchObject({ saved: true, logoUrl: identity });
    const name = identity!.slice("/uploads/".length);
    written.push(name);
    // Same store as an upload: the script is gone (#346).
    expect(await fs.promises.readFile(path.join(UPLOADS_DIR, name), "utf8")).not.toContain("<script");
  });

  it("should refuse a PDF for the logo, in words the sponsor can act on", async () => {
    const before = await storedLogos();
    fetchRemoteFile.mockResolvedValue({
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"),
      url: new URL("https://brand.example.org/logo.pdf"),
    });

    const res = await save({ logoUrl: "https://brand.example.org/logo.pdf", websiteUrl: "https://changed.example.org" });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "image_import_failed", reason: "unsupported_type", field: "logoUrl" });
    expect(res.json().message).toMatch(/n'est pas une image/);
    expect(await storedLogos()).toEqual(before);
    const sponsor = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsorId }, select: { websiteUrl: true } });
    expect(sponsor.websiteUrl).not.toBe("https://changed.example.org");
  });

  it("should say why the remote site did not answer", async () => {
    fetchRemoteFile.mockRejectedValue(new RemoteFetchError("timeout"));

    const res = await save({ logoUrl: "https://slow.example.org/logo.png" });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      reason: "timeout",
      message: "Le site distant n'a pas répondu à temps. Réessayez plus tard.",
    });
  });

  it("should keep an /uploads/ path as is, without fetching anything", async () => {
    const res = await save({ logoUrl: "/uploads/already-here.png" });

    expect(res.statusCode).toBe(200);
    expect((await storedLogos()).identity).toBe("/uploads/already-here.png");
    expect(fetchRemoteFile).not.toHaveBeenCalled();
  });

  it("should not download again an external logo already stored, sent back unchanged", async () => {
    const legacy = "https://legacy.example.org/logo.png";
    await prisma.sponsor.update({ where: { id: sponsorId }, data: { logoUrl: legacy } });

    const res = await save({ logoUrl: legacy, descriptionFr: "Bonjour" });

    expect(res.statusCode).toBe(200);
    expect(fetchRemoteFile).not.toHaveBeenCalled();
  });

  it("should store a raster logo given by URL", async () => {
    fetchRemoteFile.mockResolvedValue({ buffer: PNG_1x1, url: new URL("https://brand.example.org/logo.png") });

    const res = await save({ logoUrl: "https://brand.example.org/logo.png" });

    expect(res.statusCode).toBe(200);
    const { identity } = await storedLogos();
    expect(identity).toMatch(/^\/uploads\/.+\.png$/);
    written.push(identity!.slice("/uploads/".length));
  });
});
