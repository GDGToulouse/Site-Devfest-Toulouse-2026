import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs";
import path from "node:path";

import adminFileRoutes from "../routes/admin/files.js";
import { UPLOADS_DIR } from "../lib/image-store.js";
import { originalNamesByUrl, __testing } from "../lib/file-metadata.js";
import { prisma } from "../lib/prisma.js";

// #378 — a stored file is `<timestamp>-<random>.<ext>`, which identifies
// nothing, and a PDF has no thumbnail to recognise it by either. The upload
// route always knew the name the machine gave it: it echoed it back in the
// response and then threw it away.

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

function multipartBody(filename: string, contentType: string, content: Buffer) {
  const boundary = "----nametest";
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
    await prisma.fileMetadata.deleteMany({ where: { filename: name } });
  }
});

async function upload(filename: string, contentType = "image/png", content = PNG_1x1) {
  const app = Fastify({ logger: false });
  await app.register(multipart);
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  const { payload, headers } = multipartBody(filename, contentType, content);
  const res = await app.inject({ method: "POST", url: "/api/admin/files", payload, headers });
  await app.close();

  const body = res.statusCode === 200 ? res.json() : null;
  if (body?.filename) written.push(body.filename as string);
  return { res, body };
}

describe("uploading through the admin library", () => {
  it("keeps the name the file had on the editor's machine", async () => {
    const { body } = await upload("Charte graphique 2026.png");

    const stored = await prisma.fileMetadata.findUnique({ where: { filename: body!.filename } });
    expect(stored?.originalName).toBe("Charte graphique 2026.png");
  });

  it("hands it back in the listing, beside the stored name", async () => {
    const { body } = await upload("Kit presse.png");

    // Asserting the stored row is not enough: the library reads the listing,
    // and that is where the name has to surface.
    const names = await originalNamesByUrl([`/uploads/${body!.filename}`]);
    expect(names[`/uploads/${body!.filename}`]).toBe("Kit presse.png");
  });

  it("leaves the stored name alone — it is what the URL uses", async () => {
    const { body } = await upload("Charte graphique 2026.png");

    // The public URL stays opaque on purpose: /uploads/ is served without
    // authentication, and a document's name has no business announcing itself
    // there. The human name lives on the screens behind a login.
    expect(body!.filename).toMatch(/^\d+-[0-9a-f]{8}\.png$/);
    expect(body!.filename).not.toContain("Charte");
  });
});

describe("a name that arrives hostile", () => {
  it("keeps only the basename of a traversal attempt", () => {
    expect(__testing.clean("../../etc/passwd")).toBe("passwd");
  });

  it("keeps only the basename of a Windows path", () => {
    // A Windows browser can send the whole `C:\Users\…\file.pdf`, and POSIX
    // basename() leaves backslashes alone.
    expect(__testing.clean("C:\\Users\\julie\\Documents\\charte.pdf")).toBe("charte.pdf");
  });

  it("refuses a name that is nothing but separators", () => {
    expect(__testing.clean("..")).toBeNull();
    expect(__testing.clean("/")).toBeNull();
    expect(__testing.clean("   ")).toBeNull();
  });

  it("caps a name long enough to bloat a listing", () => {
    expect(__testing.clean(`${"a".repeat(600)}.pdf`)).toHaveLength(255);
  });
});

describe("resolving names for a batch of URLs", () => {
  it("ignores anything that is not an upload", async () => {
    const names = await originalNamesByUrl([
      "https://cdn.example.org/logo.png",
      null,
      undefined,
      "",
    ]);

    expect(names).toEqual({});
  });

  it("says nothing about files uploaded before the name was kept", async () => {
    // Every file already on disk falls in this case: there is no name to
    // recover, and the interface falls back to the stored one.
    const names = await originalNamesByUrl(["/uploads/1700000000000-deadbeef.png"]);

    expect(names).toEqual({});
  });
});
