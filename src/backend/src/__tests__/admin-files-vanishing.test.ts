import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";

import adminFileRoutes from "../routes/admin/files.js";
import { UPLOADS_DIR } from "../lib/image-store.js";

// #681 — the library lists the folder, then stats each entry. Another request
// (a delete, a test cleanup) can remove a file in between: the stat then throws
// ENOENT and the whole listing answered 500, which made unrelated suites fail
// on the shared uploads folder.

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const kept = `vanish-kept-${stamp}.png`;
const gone = `vanish-gone-${stamp}.png`;
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  await app.ready();
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOADS_DIR, kept), Buffer.from("x"));
  await fs.promises.writeFile(path.join(UPLOADS_DIR, gone), Buffer.from("x"));
});

afterAll(async () => {
  vi.restoreAllMocks();
  await app.close();
  await fs.promises.unlink(path.join(UPLOADS_DIR, kept)).catch(() => {});
  await fs.promises.unlink(path.join(UPLOADS_DIR, gone)).catch(() => {});
});

describe("GET /api/admin/files while a file is being removed (#681)", () => {
  it("should list the other files when one vanishes between the listing and its stat", async () => {
    const realStat = fs.promises.stat.bind(fs.promises);
    vi.spyOn(fs.promises, "stat").mockImplementation(async (target, ...rest) => {
      if (String(target).endsWith(gone)) throw Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
      return realStat(target, ...(rest as []));
    });

    const res = await app.inject({ method: "GET", url: "/api/admin/files" });

    expect(res.statusCode).toBe(200);
    const names = res.json().map((f: { filename: string }) => f.filename);
    expect(names).toContain(kept);
    expect(names).not.toContain(gone);
  });
});
