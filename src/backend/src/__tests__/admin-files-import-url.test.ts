import { describe, it, expect, afterEach, vi } from "vitest";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs";
import path from "node:path";

// The download itself is fetchRemoteFile's, tested on its own (safe-fetch*.test.ts).
// Here the remote site is faked, and what is asserted is the route: the type
// read from the bytes, the upload's storing path, the editor's words on refusal.
const fetchRemoteFile = vi.fn();
vi.mock("../lib/safe-fetch.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/safe-fetch.js")>()),
  fetchRemoteFile: (...args: unknown[]) => fetchRemoteFile(...args),
}));

const { default: adminFileRoutes } = await import("../routes/admin/files.js");
const { UPLOADS_DIR } = await import("../lib/image-store.js");
const { RemoteFetchError } = await import("../lib/safe-fetch.js");
const { prisma } = await import("../lib/prisma.js");

// #617 — import a file from a URL: an editor pastes a logo's address, an AI
// agent imports logos through call_route, which only sends JSON.

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

const written: string[] = [];
afterEach(async () => {
  fetchRemoteFile.mockReset();
  for (const name of written.splice(0)) {
    await fs.promises.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});
    await prisma.fileMetadata.deleteMany({ where: { filename: name } });
  }
});

async function importUrl(body: Record<string, unknown>) {
  const app = Fastify({ logger: false });
  await app.register(multipart);
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method: "POST", url: "/api/admin/files/import-url", payload: body });
  await app.close();
  if (res.statusCode === 201) written.push(res.json().filename);
  return res;
}

describe("POST /api/admin/files/import-url (#617)", () => {
  it("should store an image read from its bytes, keeping its name at the source", async () => {
    // The server lies about the type and the URL has no extension: the bytes win.
    fetchRemoteFile.mockResolvedValue({ buffer: PNG_1x1, url: new URL("https://raw.githubusercontent.com/org/repo/main/logos/lyra-logo") });

    const res = await importUrl({ url: "https://github.com/org/repo/raw/main/logos/lyra-logo", alt: "Logo Lyra" });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ mimetype: "image/png", originalName: "lyra-logo", alt: "Logo Lyra" });
    expect(res.json().filename).toMatch(/\.png$/);
    expect(fs.existsSync(path.join(UPLOADS_DIR, res.json().filename))).toBe(true);
  });

  it("should refuse a file that is neither an image nor a PDF", async () => {
    fetchRemoteFile.mockResolvedValue({ buffer: Buffer.from("<html><body>hello</body></html>"), url: new URL("https://example.org/logo.png") });

    const res = await importUrl({ url: "https://example.org/logo.png" });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "unsupported_type" });
  });

  it("should strip scripts from an SVG before writing it", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>';
    fetchRemoteFile.mockResolvedValue({ buffer: Buffer.from(svg), url: new URL("https://example.org/logo.svg") });

    const res = await importUrl({ url: "https://example.org/logo.svg" });
    const stored = await fs.promises.readFile(path.join(UPLOADS_DIR, res.json().filename), "utf8");

    expect(res.statusCode).toBe(201);
    expect(stored).not.toContain("<script");
    expect(stored).toContain("<rect");
  });

  it("should say why a private address is refused", async () => {
    fetchRemoteFile.mockRejectedValue(new RemoteFetchError("private_ip"));

    const res = await importUrl({ url: "http://169.254.169.254/latest" });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "private_ip", message: "Cette adresse pointe vers un réseau privé : elle est refusée." });
  });

  it("should refuse a body without a URL", async () => {
    const res = await importUrl({ alt: "x" });

    expect(res.statusCode).toBe(400);
    expect(fetchRemoteFile).not.toHaveBeenCalled();
  });
});
