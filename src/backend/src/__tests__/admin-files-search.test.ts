import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs";
import path from "node:path";

import adminFileRoutes from "../routes/admin/files.js";
import { UPLOADS_DIR } from "../lib/image-store.js";
import { prisma } from "../lib/prisma.js";

// #768 — finding a file by text. The route only wires the query to pageFiles
// (whose matching is unit-tested): what is checked here is the wiring, the
// default field, and that a malformed query is refused before reaching it.

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const filename = `searchtest-${stamp}.png`;
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(multipart);
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  await app.ready();
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), Buffer.from("x"));
  await prisma.fileMetadata.create({
    data: { filename, originalName: `Hall-Diagora-${stamp}.png`, alt: `Vue aérienne ${stamp}` },
  });
});

afterAll(async () => {
  await app.close();
  await fs.promises.unlink(path.join(UPLOADS_DIR, filename)).catch(() => {});
  await prisma.fileMetadata.deleteMany({ where: { filename } });
});

const list = (query: string) => app.inject({ method: "GET", url: `/api/admin/files?page=1&limit=200&${query}` });
const names = (res: Awaited<ReturnType<typeof list>>) =>
  res.json().items.map((f: { filename: string }) => f.filename);

describe("Media library search (#768)", () => {
  it("should search the original name by default", async () => {
    const res = await list(`q=${encodeURIComponent(`diagora-${stamp}`)}`);

    expect(res.statusCode).toBe(200);
    expect(names(res)).toEqual([filename]);
  });

  it("should search the alt text only when it is asked for", async () => {
    const byName = await list(`q=${encodeURIComponent(`aerienne ${stamp}`)}`);
    const byAlt = await list(`q=${encodeURIComponent(`aerienne ${stamp}`)}&in=name,alt`);

    expect(names(byName)).toEqual([]);
    expect(names(byAlt)).toEqual([filename]);
  });

  it("should refuse a search too long or an unknown field", async () => {
    const tooLong = await list(`q=${"a".repeat(101)}`);
    const unknownField = await list("q=x&in=name,usages");

    expect([tooLong.statusCode, unknownField.statusCode]).toEqual([400, 400]);
  });
});
