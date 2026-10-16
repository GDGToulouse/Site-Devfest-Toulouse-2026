import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs";
import path from "node:path";

import adminFileRoutes from "../routes/admin/files.js";
import adminFileTagRoutes from "../routes/admin/file-tags.js";
import { UPLOADS_DIR } from "../lib/image-store.js";
import { prisma } from "../lib/prisma.js";

// #373 — the media library sorted by subject. Tags of their own (never the
// public article tags), created on the fly, and a filter in the library. A file
// has a metadata row only once something was set on it: tagging a bare one must
// create it, not be lost.

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const filename = `tagtest-${stamp}.png`;
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(multipart);
  await app.register(adminFileRoutes, { prefix: "/api/admin" });
  await app.register(adminFileTagRoutes, { prefix: "/api/admin" });
  await app.ready();
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), Buffer.from("x"));
});

afterAll(async () => {
  await app.close();
  await fs.promises.unlink(path.join(UPLOADS_DIR, filename)).catch(() => {});
  await prisma.fileMetadata.deleteMany({ where: { filename } });
  await prisma.fileTag.deleteMany({ where: { name: { contains: stamp } } });
});

const createTag = (name: string) => app.inject({ method: "POST", url: "/api/admin/file-tags", payload: { name } });

describe("Media library tags (#373)", () => {
  it("should tag a file that had no metadata yet, and list and filter by that tag", async () => {
    const logos = (await createTag(`Logos ${stamp}`)).json();

    const tagged = await app.inject({ method: "PUT", url: `/api/admin/files/${filename}/tags`, payload: { tagIds: [logos.id] } });
    const page = await app.inject({ method: "GET", url: `/api/admin/files?page=1&limit=200&tag=${logos.slug}` });
    const untagged = await app.inject({ method: "GET", url: "/api/admin/files?page=1&limit=200&tag=none" });

    expect(tagged.statusCode).toBe(200);
    expect(tagged.json().tags).toEqual([expect.objectContaining({ id: logos.id, name: `Logos ${stamp}` })]);
    expect(page.json().items.map((f: { filename: string }) => f.filename)).toEqual([filename]);
    expect(untagged.json().items.map((f: { filename: string }) => f.filename)).not.toContain(filename);
  });

  it("should answer a name already taken, whatever its case, with the existing tag", async () => {
    const first = (await createTag(`Photos ${stamp}`)).json();

    const again = await createTag(`photos ${stamp}`);

    expect(again.statusCode).toBe(409);
    expect(again.json().existing).toMatchObject({ id: first.id });
  });

  it("should refuse an unknown tag and a path outside the library", async () => {
    const unknown = await app.inject({ method: "PUT", url: `/api/admin/files/${filename}/tags`, payload: { tagIds: [2147483000] } });
    const outside = await app.inject({ method: "PUT", url: "/api/admin/files/..%2Fsecret/tags", payload: { tagIds: [] } });

    expect(unknown.statusCode).toBe(422);
    expect(outside.statusCode).toBe(400);
  });

  it("should count the files of each tag", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/file-tags" });
    const logos = res.json().find((t: { name: string }) => t.name === `Logos ${stamp}`);

    expect(logos.fileCount).toBe(1);
  });
});
