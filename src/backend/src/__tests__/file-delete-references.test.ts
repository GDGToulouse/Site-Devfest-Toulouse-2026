import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import fs from "node:fs";
import path from "node:path";

import adminFileRoutes from "../routes/admin/files.js";
import { UPLOADS_DIR } from "../lib/image-store.js";
import { prisma } from "../lib/prisma.js";

// #486 — the media library is a *shared* library: the same upload can be a
// speaker's photo, a sponsor's frozen logo and the site's header logo at once.
// Deleting from /admin/files always succeeded, leaving the referencing column
// pointing at a file that no longer exists. No fallback catches that — the
// speaker's initial only shows when photoUrl is null, and here it stays set.

async function deleteFile(filename: string) {
  const app = Fastify({ logger: false });
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method: "DELETE", url: `/api/admin/files/${filename}` });
  await app.close();
  return res;
}

/** A real file on disk, so a passing delete is a delete that actually happened. */
async function writeUpload(): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}.png`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), "not-really-a-png");
  written.push(filename);
  return filename;
}

const written: string[] = [];
const speakerIds: number[] = [];
const settingKeys: string[] = [];

afterEach(async () => {
  for (const id of speakerIds.splice(0)) {
    await prisma.speaker.delete({ where: { id } }).catch(() => {});
  }
  for (const key of settingKeys.splice(0)) {
    await prisma.siteSetting.deleteMany({ where: { key } });
  }
  for (const name of written.splice(0)) {
    await fs.promises.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});
    await prisma.fileMetadata.deleteMany({ where: { filename: name } });
  }
});

describe("deleting a file from the media library", () => {
  it("removes one nothing points at", async () => {
    const filename = await writeUpload();

    const res = await deleteFile(filename);

    expect(res.statusCode).toBe(200);
    await expect(fs.promises.access(path.join(UPLOADS_DIR, filename))).rejects.toThrow();
  });

  it("refuses in 409 when a speaker still shows it", async () => {
    const filename = await writeUpload();
    const speaker = await prisma.speaker.create({
      data: {
        name: "Référence Test",
        slug: `reference-test-${Date.now()}`,
        photoUrl: `/uploads/${filename}`,
      },
    });
    speakerIds.push(speaker.id);

    const res = await deleteFile(filename);

    expect(res.statusCode).toBe(409);
    // The file must still be there: a refusal that deleted anyway is worse
    // than no guard at all.
    await expect(fs.promises.access(path.join(UPLOADS_DIR, filename))).resolves.toBeUndefined();
  });

  it("names what is using it, so the admin knows where to go", async () => {
    const filename = await writeUpload();
    const speaker = await prisma.speaker.create({
      data: {
        name: "Référence Nommée",
        slug: `reference-nommee-${Date.now()}`,
        photoUrl: `/uploads/${filename}`,
      },
    });
    speakerIds.push(speaker.id);

    const res = await deleteFile(filename);

    expect(res.json().error).toContain("speaker");
    expect(res.json().usages).toEqual([{ model: "speaker", field: "photoUrl", count: 1 }]);
  });

  // The site logo, the favicons, the home carousel and the OG image are
  // key/value rows, not typed columns — so no `fileFields` entry can describe
  // them. They are also the most visible references there are: deleting the
  // logo breaks the header of every page on the site.
  it("refuses one held by the site settings", async () => {
    const filename = await writeUpload();
    // A key of its own rather than the real `identity_logo_main`: the scan is
    // on `value`, so the key is irrelevant to what is verified, and borrowing a
    // real one collides with whatever the local database already holds.
    const key = `test_identity_logo_${Date.now()}`;
    await prisma.siteSetting.create({ data: { key, value: `/uploads/${filename}` } });
    settingKeys.push(key);

    const res = await deleteFile(filename);

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("réglages du site");
  });

  it("refuses one buried in a setting's JSON, as the carousel stores it", async () => {
    const filename = await writeUpload();
    const key = `test_about_carousel_${Date.now()}`;
    await prisma.siteSetting.create({
      data: { key, value: JSON.stringify([{ url: `/uploads/${filename}`, alt: "Ambiance" }]) },
    });
    settingKeys.push(key);

    const res = await deleteFile(filename);

    expect(res.statusCode).toBe(409);
  });

  it("still refuses a filename that traverses", async () => {
    const res = await deleteFile("..%2F..%2Fetc%2Fpasswd");

    expect(res.statusCode).toBe(400);
  });
});
