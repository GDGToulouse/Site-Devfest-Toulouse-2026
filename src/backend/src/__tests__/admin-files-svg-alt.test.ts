import { describe, it, expect, afterAll, vi } from "vitest";

// No Gemini in tests: the client is stubbed, and the image it would have
// received is inspected instead.
const { callGeminiMock } = vi.hoisted(() => ({
  callGeminiMock: vi.fn().mockResolvedValue({ text: "Logo rond rouge", inputTokens: 10, outputTokens: 5 }),
}));
vi.mock("../lib/translation/gemini-client.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/translation/gemini-client.js")>()),
  isConfigured: () => true,
  callGemini: callGeminiMock,
}));

import Fastify from "fastify";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import adminFileRoutes from "../routes/admin/files.js";
import { UPLOADS_DIR } from "../lib/image-store.js";

// #504 — a logo is usually an SVG, and alt-text generation refused SVG with a
// 415. Gemini reads pixels, so the SVG is rendered first — at a size it can
// read: a viewBox 10 units wide must not reach the model as a 10 px image.

const FILENAME = `test-alt-${Date.now()}.svg`;
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#c00"/></svg>`;
const TALL_FILENAME = `test-alt-tall-${Date.now()}.svg`;
const TALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1000"><rect width="1" height="1000" fill="#00c"/></svg>`;

afterAll(async () => {
  await fs.promises.rm(path.join(UPLOADS_DIR, FILENAME), { force: true });
  await fs.promises.rm(path.join(UPLOADS_DIR, TALL_FILENAME), { force: true });
});

async function generateAlt(filename: string, svg: string) {
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), svg);
  const app = Fastify({ logger: false });
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method: "POST", url: `/api/admin/files/${filename}/generate-alt` });
  await app.close();
  return res;
}

describe("POST /api/admin/files/:filename/generate-alt on an SVG (#504)", () => {
  it("should describe an SVG, sending Gemini a PNG wide enough to read", async () => {
    callGeminiMock.mockClear();

    const res = await generateAlt(FILENAME, SVG);

    expect(res.statusCode).toBe(200);
    expect(res.json().alt).toBe("Logo rond rouge");
    const [image] = callGeminiMock.mock.calls[0][0].inlineImages;
    expect(image.mimeType).toBe("image/png");
    const { width } = await sharp(Buffer.from(image.base64, "base64")).metadata();
    expect(width).toBe(768);
  });

  it("should bound both sides of an elongated SVG, so rendering cannot blow up memory", async () => {
    callGeminiMock.mockClear();

    const res = await generateAlt(TALL_FILENAME, TALL_SVG);

    expect(res.statusCode).toBe(200);
    const [image] = callGeminiMock.mock.calls[0][0].inlineImages;
    const { height } = await sharp(Buffer.from(image.base64, "base64")).metadata();
    expect(height).toBeLessThanOrEqual(768);
  });
});
