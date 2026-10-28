import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The remote site is faked: the download itself is fetchRemoteFile's, tested on
// its own (safe-fetch*.test.ts). What is asserted here is that the edit link
// stores an imported copy, never the address it was given.
const fetchRemoteFile = vi.fn();
vi.mock("../lib/safe-fetch.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/safe-fetch.js")>()),
  fetchRemoteFile: (...args: unknown[]) => fetchRemoteFile(...args),
}));

const { buildEditApp } = await import("./test-edit-app.js");
const { prisma } = await import("../lib/prisma.js");
const { UPLOADS_DIR } = await import("../lib/image-store.js");
const { RemoteFetchError } = await import("../lib/safe-fetch.js");
const { getSeededEdition } = await import("./edition-test-helpers.js");

// #687 — a photo pasted as a URL in the edit link was saved as that URL: the
// share card only embeds /uploads/ images, and the third-party host can change
// or drop the file. The backend imports it and saves the local path instead.

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

const TOKEN = "test-edit-photo-import-token-0123456789abcdef";
const LEGACY_URL = "https://legacy.example.org/old-photo.jpg";
let speakerId: number;
const written: string[] = [];

beforeAll(async () => {
  const edition = await getSeededEdition();
  const speaker = await prisma.speaker.create({
    data: {
      name: "Photo Import Speaker",
      slug: `photo-import-speaker-${Date.now()}`,
      editToken: TOKEN,
      editTokenSentAt: new Date(),
      editions: { create: [{ editionId: edition.id, publicationStatus: "PUBLISHED" }] },
    },
  });
  speakerId = speaker.id;
});

afterEach(() => {
  fetchRemoteFile.mockReset();
});

afterAll(async () => {
  for (const name of written.splice(0)) {
    await fs.promises.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});
    await prisma.fileMetadata.deleteMany({ where: { filename: name } });
  }
  if (speakerId !== undefined) {
    await prisma.speaker.deleteMany({ where: { id: speakerId } });
  }
});

async function save(body: Record<string, unknown>) {
  const app = await buildEditApp();
  const res = await app.inject({ method: "PUT", url: `/api/edit/${TOKEN}`, payload: body });
  await app.close();
  return res;
}

async function storedPhoto() {
  return (await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId }, select: { photoUrl: true } })).photoUrl;
}

describe("PUT /api/edit/:token — photo given as a URL (#687)", () => {
  it("should save an imported /uploads/ copy instead of the remote URL", async () => {
    fetchRemoteFile.mockResolvedValue({ buffer: PNG_1x1, url: new URL("https://cdn.example.org/me.png") });

    const res = await save({ photoUrl: "https://cdn.example.org/me.png" });

    expect(res.statusCode).toBe(200);
    const photoUrl = await storedPhoto();
    expect(photoUrl).toMatch(/^\/uploads\/.+\.png$/);
    written.push(photoUrl!.slice("/uploads/".length));
    expect(res.json()).toMatchObject({ saved: true, photoUrl });
    expect(fs.existsSync(path.join(UPLOADS_DIR, photoUrl!.slice("/uploads/".length)))).toBe(true);
  });

  it("should refuse a file that is not an image, in words the speaker can act on", async () => {
    await prisma.speaker.update({ where: { id: speakerId }, data: { photoUrl: null } });
    fetchRemoteFile.mockResolvedValue({ buffer: Buffer.from("<html>nope</html>"), url: new URL("https://example.org/me.png") });

    const res = await save({ photoUrl: "https://example.org/me.png", city: "Albi" });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "image_import_failed", reason: "unsupported_type", field: "photoUrl" });
    expect(res.json().message).toMatch(/n'est pas une image/);
    // Nothing of the payload is written when the photo fails.
    const speaker = await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } });
    expect(speaker.photoUrl).toBeNull();
    expect(speaker.city).not.toBe("Albi");
  });

  it("should refuse an SVG: the edit link takes raster photos only", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    fetchRemoteFile.mockResolvedValue({ buffer: Buffer.from(svg), url: new URL("https://example.org/me.svg") });

    const res = await save({ photoUrl: "https://example.org/me.svg" });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ reason: "unsupported_type" });
  });

  it("should say why an address refused by the protected client is refused", async () => {
    fetchRemoteFile.mockRejectedValue(new RemoteFetchError("private_ip"));

    const res = await save({ photoUrl: "http://169.254.169.254/latest" });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      reason: "private_ip",
      message: "Cette adresse pointe vers un réseau privé : elle est refusée.",
    });
  });

  it("should cap the download at the edit link's own upload limit", async () => {
    fetchRemoteFile.mockRejectedValue(new RemoteFetchError("too_large"));

    const res = await save({ photoUrl: "https://example.org/huge.jpg" });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ reason: "too_large", message: "Le fichier dépasse 5 Mo." });
    expect(fetchRemoteFile).toHaveBeenCalledWith("https://example.org/huge.jpg", expect.objectContaining({ maxBytes: 5_000_000 }));
  });

  it("should keep an /uploads/ path as is, without fetching anything", async () => {
    const res = await save({ photoUrl: "/uploads/already-here.png" });

    expect(res.statusCode).toBe(200);
    expect(await storedPhoto()).toBe("/uploads/already-here.png");
    expect(fetchRemoteFile).not.toHaveBeenCalled();
  });

  it("should not download again an external URL already stored, sent back unchanged", async () => {
    // A legacy value: the form sends every field on each save, and a bio fix
    // must not hinge on a third-party host still serving the old photo.
    await prisma.speaker.update({ where: { id: speakerId }, data: { photoUrl: LEGACY_URL } });

    const res = await save({ photoUrl: LEGACY_URL, city: "Toulouse" });

    expect(res.statusCode).toBe(200);
    expect(fetchRemoteFile).not.toHaveBeenCalled();
    expect(await storedPhoto()).toBe(LEGACY_URL);
  });

  it("should still clear the photo with an empty string", async () => {
    const res = await save({ photoUrl: "" });

    expect(res.statusCode).toBe(200);
    expect(await storedPhoto()).toBeNull();
    expect(fetchRemoteFile).not.toHaveBeenCalled();
  });
});
