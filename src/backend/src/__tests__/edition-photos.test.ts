process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// The writes carry requireAdminRole (#530), which this bare app cannot skip:
// the caller is stubbed as an ADMIN. Who may write is pinned by route-guards.
vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => ({
    user: { id: "test-admin", email: "admin@test.local", name: "Test", role: "ADMIN" },
  }),
}));

const { default: adminEditionPhotoRoutes } = await import("../routes/admin/edition-photos.js");
const { default: editionRoutes } = await import("../routes/editions.js");
const { prisma } = await import("../lib/prisma.js");

// #112 — the team picks an edition's photos from the media library; the
// edition page shows them in that order, with an alt text for each.

// A year no other test file uses (#292).
const YEAR = 1956;
const FILE = `zq112-${Date.now()}.jpg`;

let app: FastifyInstance;
let editionId: number;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminEditionPhotoRoutes, { prefix: "/api/admin" });
  await app.register(editionRoutes, { prefix: "/api" });
  editionId = (await prisma.edition.create({ data: { year: YEAR, status: "SEE_YOU_NEXT_YEAR" } })).id;
  await prisma.fileMetadata.create({ data: { filename: FILE, alt: "La salle comble pendant la keynote" } });
});

afterAll(async () => {
  await prisma.edition.delete({ where: { id: editionId } });
  await prisma.fileMetadata.delete({ where: { filename: FILE } });
  await app.close();
});

const add = (url: string, alt?: string) =>
  app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/photos`, payload: { url, ...(alt && { alt }) } });

const publicPhotos = async () => (await app.inject({ method: "GET", url: `/api/editions/${YEAR}` })).json().photos as { url: string; alt: string | null }[];

describe("Edition gallery (#112)", () => {
  it("should show the picked photos in the team's order, each with its alt text", async () => {
    const first = (await add(`/uploads/${FILE}`)).json();
    const second = (await add("/uploads/zq112-other.jpg", "Le stand du GDG")).json();

    expect(await publicPhotos()).toEqual([
      // No alt of its own: the media library's.
      { url: `/uploads/${FILE}`, alt: "La salle comble pendant la keynote" },
      { url: "/uploads/zq112-other.jpg", alt: "Le stand du GDG" },
    ]);

    await app.inject({ method: "PUT", url: `/api/admin/editions/${editionId}/photos/order`, payload: { ids: [second.id, first.id] } });

    expect((await publicPhotos()).map((p) => p.url)).toEqual(["/uploads/zq112-other.jpg", `/uploads/${FILE}`]);
  });

  it("should refuse an image that is not in the media library", async () => {
    const res = await add("https://example.com/photo.jpg");

    expect(res.statusCode).toBe(422);
  });

  it("should take a photo out of the gallery", async () => {
    const photo = (await add("/uploads/zq112-gone.jpg")).json();

    const res = await app.inject({ method: "DELETE", url: `/api/admin/edition-photos/${photo.id}` });

    expect(res.statusCode).toBe(204);
    expect((await publicPhotos()).map((p) => p.url)).not.toContain("/uploads/zq112-gone.jpg");
  });

  it("should fall back on the media library's alt once the photo's own is cleared", async () => {
    const photo = (await add(`/uploads/${FILE}`, "Texte provisoire")).json();

    await app.inject({ method: "PUT", url: `/api/admin/edition-photos/${photo.id}`, payload: { alt: "  " } });

    const listed = (await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}/photos` })).json();
    expect(listed.find((p: { id: number }) => p.id === photo.id)).toMatchObject({ ownAlt: null, alt: "La salle comble pendant la keynote" });
  });
});
