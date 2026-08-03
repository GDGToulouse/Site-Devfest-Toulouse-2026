import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorWithToken, tierIdByKey } from "./sponsor-test-helpers.js";

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
    const edition = await getSeededEdition();
    editionId = edition.id;
    const sponsor = await createSponsorWithToken(
      { name: "Upload Test Sponsor", slug: "upload-test-sponsor", tierId: await tierIdByKey("gold"), editionId },
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

  // #346 — a sponsor may now send a vector logo through their magic link. This
  // endpoint is unauthenticated, so what lands on disk has to be inert: the
  // file is served same-origin from /uploads/.
  it("stores a sponsor SVG with its script stripped", async () => {
    const app = await buildEditApp();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h24v24H0z"/></svg>',
    );
    const { payload, headers } = multipartBody("logo.svg", "image/svg+xml", svg);

    const res = await app.inject({ method: "POST", url: `/api/edit/${TOKEN}/upload`, payload, headers });

    expect(res.statusCode).toBe(200);
    const url = res.json().url as string;
    expect(url).toMatch(/^\/uploads\/.+\.svg$/);

    const { UPLOADS_DIR } = await import("../lib/image-store.js");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const stored = await fs.promises.readFile(path.join(UPLOADS_DIR, path.basename(url)), "utf8");
    expect(stored).not.toMatch(/<script/i);
    expect(stored).not.toContain("alert(1)");
    expect(stored).toContain("<path");

    await fs.promises.unlink(path.join(UPLOADS_DIR, path.basename(url))).catch(() => {});
    await app.close();
  });

  it("rejects an SVG that carries nothing but a script", async () => {
    const app = await buildEditApp();
    const { payload, headers } = multipartBody("evil.svg", "image/svg+xml", Buffer.from("<script>alert(1)</script>"));

    const res = await app.inject({ method: "POST", url: `/api/edit/${TOKEN}/upload`, payload, headers });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_file_type");
    await app.close();
  });

  // #374 — the com-kit charter is a PDF. storeImageBuffer compresses anything
  // that isn't SVG and falls back to ".jpg" for unknown mimetypes, so a PDF
  // would reach sharp and be stored under the wrong extension without its own
  // branch. Assert the bytes survive untouched.
  it("stores a PDF charter as-is, with a .pdf extension", async () => {
    const app = await buildEditApp();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<</Type/Catalog>>\nendobj\ntrailer\n%%EOF\n");
    const { payload, headers } = multipartBody("charte.pdf", "application/pdf", pdf);

    const res = await app.inject({ method: "POST", url: `/api/edit/${TOKEN}/upload`, payload, headers });

    expect(res.statusCode).toBe(200);
    const url = res.json().url as string;
    expect(url).toMatch(/^\/uploads\/.+\.pdf$/);

    const { UPLOADS_DIR } = await import("../lib/image-store.js");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const stored = await fs.promises.readFile(path.join(UPLOADS_DIR, path.basename(url)));
    expect(stored.equals(pdf)).toBe(true);

    await fs.promises.unlink(path.join(UPLOADS_DIR, path.basename(url))).catch(() => {});
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
