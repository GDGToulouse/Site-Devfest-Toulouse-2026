import { describe, it, expect } from "vitest";

import Fastify from "fastify";
import multipart from "@fastify/multipart";
import adminFileRoutes from "../routes/admin/files.js";

// The admin uploader used to accept image/svg+xml. Served same-origin from
// /uploads/, an SVG carrying <script> runs in our origin (#306). The magic-link
// uploader already refuses SVG; this proves the admin one now does too.

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

describe("admin uploader rejects SVG (#306)", () => {
  it("refuses an image/svg+xml upload", async () => {
    const app = await buildFilesApp();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const { payload, headers } = multipartBody("payload.svg", "image/svg+xml", svg);

    const res = await app.inject({ method: "POST", url: "/api/admin/files", payload, headers });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Invalid file type");

    await app.close();
  });

  it("still accepts a PNG", async () => {
    const app = await buildFilesApp();
    const { payload, headers } = multipartBody("ok.png", "image/png", PNG_1x1);

    const res = await app.inject({ method: "POST", url: "/api/admin/files", payload, headers });

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toMatch(/^\/uploads\//);

    // Clean up the file this test wrote to the uploads dir.
    const { UPLOADS_DIR } = await import("../lib/image-store.js");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const name = res.json().filename as string;
    await fs.promises.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});

    await app.close();
  });
});
