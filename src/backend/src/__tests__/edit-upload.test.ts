import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

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
let speakerId: number;

describe("POST /api/edit/:token/upload", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    const speaker = await prisma.speaker.create({
      data: {
        name: "Upload Test Speaker",
        slug: `upload-test-speaker-${Date.now()}`,
        editToken: TOKEN,
        editTokenSentAt: new Date(),
        editions: { create: [{ editionId: edition.id, publicationStatus: "PUBLISHED" }] },
      },
    });
    speakerId = speaker.id;
  });

  afterAll(async () => {
    await prisma.speaker.deleteMany({ where: { id: speakerId } });
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

  // SVG and PDF were allowed here for the sponsor logo and com-kit charter
  // (#346, #374). Sponsors upload through their authenticated space now (#362),
  // and this endpoint — where the token is the only credential — is back to the
  // raster formats a speaker photo actually needs.
  it("rejects an SVG, which only sponsors ever needed", async () => {
    const app = await buildEditApp();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"/></svg>');
    const { payload, headers } = multipartBody("logo.svg", "image/svg+xml", svg);

    const res = await app.inject({ method: "POST", url: `/api/edit/${TOKEN}/upload`, payload, headers });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_file_type");
    await app.close();
  });

  it("rejects a PDF, which only the com-kit charter needed", async () => {
    const app = await buildEditApp();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<</Type/Catalog>>\nendobj\ntrailer\n%%EOF\n");
    const { payload, headers } = multipartBody("charte.pdf", "application/pdf", pdf);

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
