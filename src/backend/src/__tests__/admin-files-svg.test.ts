import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs";
import path from "node:path";
import adminFileRoutes from "../routes/admin/files.js";
import { UPLOADS_DIR } from "../lib/image-store.js";

// #306 refused SVG outright; #346 accepts it again, but only sanitized. What
// matters is no longer the status code — it is what ends up on disk, since
// /uploads/ serves these files same-origin.

async function buildFilesApp() {
  const app = Fastify({ logger: false });
  await app.register(multipart);
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  return app;
}

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

function multipartBody(filename: string, contentType: string, content: Buffer) {
  const boundary = "----svgtest";
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

const written: string[] = [];

afterEach(async () => {
  for (const name of written.splice(0)) {
    await fs.promises.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});
  }
});

async function upload(filename: string, contentType: string, content: Buffer) {
  const app = await buildFilesApp();
  const { payload, headers } = multipartBody(filename, contentType, content);
  const res = await app.inject({ method: "POST", url: "/api/admin/files", payload, headers });
  await app.close();

  const body = res.statusCode === 200 ? res.json() : null;
  if (body?.filename) written.push(body.filename as string);
  return { res, body };
}

describe("admin uploader — SVG is stored sanitized (#346)", () => {
  it("should strip a script from an uploaded SVG before writing it", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h24v24H0z"/></svg>',
    );

    const { res, body } = await upload("logo.svg", "image/svg+xml", svg);

    expect(res.statusCode).toBe(200);
    const stored = await fs.promises.readFile(path.join(UPLOADS_DIR, body!.filename), "utf8");
    expect(stored).not.toMatch(/<script/i);
    expect(stored).not.toContain("alert(1)");
    expect(stored).toContain("<path");
  });

  it("should strip event handlers before writing", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" onload="alert(1)"/></svg>',
    );

    const { body } = await upload("handler.svg", "image/svg+xml", svg);

    const stored = await fs.promises.readFile(path.join(UPLOADS_DIR, body!.filename), "utf8");
    expect(stored).not.toMatch(/onload/i);
  });

  // Nothing renderable is left, so there is no logo to store — say so instead
  // of writing an empty document.
  it("should refuse an SVG that is nothing but a script", async () => {
    const svg = Buffer.from("<script>alert(1)</script>");

    const { res } = await upload("evil.svg", "image/svg+xml", svg);

    expect(res.statusCode).toBe(400);
  });

  it("should still accept a PNG", async () => {
    const { res, body } = await upload("ok.png", "image/png", PNG_1x1);

    expect(res.statusCode).toBe(200);
    expect(body!.url).toMatch(/^\/uploads\//);
  });
});
