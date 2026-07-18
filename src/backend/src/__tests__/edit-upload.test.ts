import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { createSponsorWithToken } from "./sponsor-test-helpers.js";

// A 1x1 transparent PNG — smallest valid raster image sharp will accept.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

// Build a minimal multipart/form-data body by hand (no form-data dependency).
function multipartBody(filename: string, contentType: string, content: Buffer) {
  const boundary = "----edittest";
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

const TOKEN = "test-edit-upload-token-abcdef0123456789";
let editionId: number;
let sponsorId: number;

describe("POST /api/edit/:token/upload", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirst({ orderBy: { year: "desc" } });
    if (!edition) throw new Error("seed missing an edition");
    editionId = edition.id;
    const sponsor = await createSponsorWithToken(
      { name: "Upload Test Sponsor", slug: "upload-test-sponsor", level: "GOLD", editionId },
      TOKEN,
    );
    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
  });

  it("stores an uploaded image and returns its /uploads URL", async () => {
    const app = await buildEditApp();
    const { payload, headers } = multipartBody("logo.png", "image/png", PNG_1x1);
    const res = await app.inject({ method: "POST", url: `/api/edit/${TOKEN}/upload`, payload, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().url).toMatch(/^\/uploads\/.+\.(png|jpg|webp|gif)$/);
    await app.close();
  });

  it("rejects a non-image file", async () => {
    const app = await buildEditApp();
    const { payload, headers } = multipartBody("note.txt", "text/plain", Buffer.from("not an image"));
    const res = await app.inject({ method: "POST", url: `/api/edit/${TOKEN}/upload`, payload, headers });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_file_type");
    await app.close();
  });

  it("returns 404 for an unknown token", async () => {
    const app = await buildEditApp();
    const { payload, headers } = multipartBody("logo.png", "image/png", PNG_1x1);
    const res = await app.inject({ method: "POST", url: "/api/edit/unknown-token-xyz/upload", payload, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
