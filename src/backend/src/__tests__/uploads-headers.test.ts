import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { uploadsStaticOptions } from "../lib/upload-headers.js";

// What a file under /uploads/ may do once opened directly (#671): the headers
// are set where the response is produced, by @fastify/static in server.ts,
// which takes the same options. Next's /uploads rewrite passes them through.

const FILES: Record<string, string | Buffer> = {
  "photo.jpg": Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  "legacy.jpeg": Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  "LEGACY.PNG": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  "logo.webp": Buffer.from("RIFF0000WEBP"),
  "icon.ico": Buffer.from([0x00, 0x00, 0x01, 0x00]),
  "logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
  "brochure.pdf": "%PDF-1.7\n%%EOF\n",
  "deck.pptx": Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  "sheet.xls": Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
  "page.html": "<script>alert(document.cookie)</script>",
  "page.htm": "<script>alert(document.cookie)</script>",
  "script.js": "alert(1)",
  "data.xml": "<x/>",
  "noextension": "<script>alert(1)</script>",
};

let app: FastifyInstance;
let root: string;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-headers-"));
  for (const [name, content] of Object.entries(FILES)) fs.writeFileSync(path.join(root, name), content);
  app = Fastify();
  await app.register(fastifyStatic, uploadsStaticOptions(root));
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  if (root !== undefined) fs.rmSync(root, { recursive: true, force: true });
});

const get = (name: string) => app.inject({ method: "GET", url: `/uploads/${name}` });

describe("GET /uploads/* (#671)", () => {
  it.each(["photo.jpg", "legacy.jpeg", "LEGACY.PNG", "logo.webp", "icon.ico"])(
    "serves raster image %s inline, without sandbox",
    async (name) => {
      const res = await get(name);
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBeUndefined();
      expect(res.headers["content-disposition"]).toBeUndefined();
      expect(res.headers["cache-control"]).toContain("immutable");
    },
  );

  it("serves SVG inline under a sandbox CSP (#346)", async () => {
    const res = await get("logo.svg");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.headers["content-security-policy"]).toBe("sandbox; default-src 'none'; style-src 'unsafe-inline'");
    expect(res.headers["content-disposition"]).toBeUndefined();
  });

  // The brochure is opened in a tab from the e-mail link; Chrome will not load
  // its PDF viewer in a sandboxed document.
  it("serves PDF inline, without sandbox, so the browser viewer opens it", async () => {
    const res = await get("brochure.pdf");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["content-disposition"]).toBeUndefined();
  });

  it("keeps PDF byte ranges working for the viewer (#469)", async () => {
    const res = await app.inject({ method: "GET", url: "/uploads/brochure.pdf", headers: { range: "bytes=0-3" } });
    expect(res.statusCode).toBe(206);
    expect(res.body).toBe("%PDF");
  });

  it.each(["deck.pptx", "sheet.xls"])("serves Office document %s as a sandboxed download", async (name) => {
    const res = await get(name);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toBe("sandbox");
    expect(res.headers["content-disposition"]).toBe("attachment");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it.each(["page.html", "page.htm", "script.js", "data.xml", "noextension"])(
    "refuses %s, outside the served extensions",
    async (name) => {
      const res = await get(name);
      expect(res.statusCode).toBe(404);
      expect(res.body).not.toContain("<script>");
    },
  );
});
