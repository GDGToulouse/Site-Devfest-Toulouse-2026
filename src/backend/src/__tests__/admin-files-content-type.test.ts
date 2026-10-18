import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs";
import path from "node:path";
import adminFileRoutes from "../routes/admin/files.js";
import { UPLOADS_DIR } from "../lib/image-store.js";

// /uploads/ is served same-origin, with a content-type taken from the stored
// extension. Neither the declared mimetype nor the client's file name may
// choose it: the bytes say what the file is, as for the import by URL (#617).

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
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n");
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);

function multipartBody(filename: string, contentType: string, content: Buffer) {
  const boundary = "----typetest";
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

describe("admin uploader — the bytes decide the stored type", () => {
  it("should refuse a script declared as a PDF", async () => {
    const { res } = await upload("payload.js", "application/pdf", Buffer.from('document.title="x";'));

    expect(res.statusCode).toBe(400);
  });

  it("should refuse an HTML page declared as an image", async () => {
    const { res } = await upload("page.html", "image/png", Buffer.from("<html><body>x</body></html>"));

    expect(res.statusCode).toBe(400);
  });

  it("should store a real PNG under .png whatever the client named it", async () => {
    const { res, body } = await upload("logo.html", "application/pdf", PNG_1x1);

    expect(res.statusCode).toBe(200);
    expect(body!.filename).toMatch(/\.png$/);
    expect(body!.mimetype).toBe("image/png");
  });

  it("should sanitize an SVG even when declared as a PDF", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0"/></svg>');

    const { res, body } = await upload("logo.pdf", "application/pdf", svg);

    expect(res.statusCode).toBe(200);
    expect(body!.filename).toMatch(/\.svg$/);
    const stored = await fs.promises.readFile(path.join(UPLOADS_DIR, body!.filename), "utf8");
    expect(stored).not.toMatch(/<script/i);
  });

  it("should accept a PDF", async () => {
    const { res, body } = await upload("brochure.pdf", "application/pdf", PDF);

    expect(res.statusCode).toBe(200);
    expect(body!.filename).toMatch(/\.pdf$/);
  });

  // Office files have no signature of their own: a zip or an OLE container,
  // whose extension must then belong to the matching closed list.
  it("should accept an Office document whose container matches its extension", async () => {
    const pptx = await upload("deck.pptx", "application/octet-stream", ZIP);
    const xls = await upload("budget.xls", "application/vnd.ms-excel", OLE);

    expect(pptx.res.statusCode).toBe(200);
    expect(pptx.body!.filename).toMatch(/\.pptx$/);
    expect(xls.res.statusCode).toBe(200);
    expect(xls.body!.filename).toMatch(/\.xls$/);
  });

  it("should refuse a zip that does not carry an Office extension", async () => {
    const { res } = await upload("bundle.html", "application/pdf", ZIP);

    expect(res.statusCode).toBe(400);
  });

  it("should refuse an Office extension on the wrong container", async () => {
    const { res } = await upload("deck.docx", "application/msword", Buffer.from("<html></html>"));

    expect(res.statusCode).toBe(400);
  });
});
