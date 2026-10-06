process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// #530 — the team reads editions, venues and rooms; only an ADMIN writes them
// (decision of 2026-10-06). Editors' screens list editions and rooms (import,
// speaker, talk, sponsor, dashboard) and got a 403 on every one of those reads.
// The auth context is stubbed and the real server built, so the guards tested
// are the ones the server registers.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-editor", email: "editor@test.local", name: "Ed", role: "EDITOR" } },
}));

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

const { buildServer } = await import("../server.js");
const { getSeededEdition } = await import("./edition-test-helpers.js");
const { prisma } = await import("../lib/prisma.js");

let app: FastifyInstance;
let editionId: number;
let venueId: number;
let roomId: number;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
  editionId = (await getSeededEdition()).id;
  const venue = await prisma.venue.findFirstOrThrow({ where: { rooms: { some: {} } }, include: { rooms: true } });
  venueId = venue.id;
  roomId = venue.rooms[0].id;
});

afterAll(async () => {
  await app.close();
});

const get = (url: string) => app.inject({ method: "GET", url });

describe("Editions, venues and rooms: the team reads, an ADMIN writes (#530)", () => {
  it("should let an EDITOR read the editions an editor's screens list", async () => {
    expect((await get("/api/admin/editions")).statusCode).toBe(200);
    expect((await get("/api/admin/editions/current")).statusCode).toBe(200);
    expect((await get(`/api/admin/editions/${editionId}`)).statusCode).toBe(200);
    expect((await get(`/api/admin/editions/${editionId}/key-figures`)).statusCode).toBe(200);
  });

  it("should let an EDITOR read venues and their rooms", async () => {
    expect((await get("/api/admin/venues")).statusCode).toBe(200);
    expect((await get(`/api/admin/venues/${venueId}`)).statusCode).toBe(200);
  });

  it("should refuse an EDITOR writing an edition", async () => {
    const update = await app.inject({ method: "PUT", url: `/api/admin/editions/${editionId}`, payload: { galleryUrl: null } });
    const create = await app.inject({ method: "POST", url: "/api/admin/editions", payload: { year: 1902 } });
    const featured = await app.inject({ method: "PUT", url: "/api/admin/editions/featured", payload: { editionId } });

    expect(update.statusCode).toBe(403);
    expect(create.statusCode).toBe(403);
    expect(featured.statusCode).toBe(403);
  });

  it("should refuse an EDITOR writing a venue or a room", async () => {
    const venue = await app.inject({ method: "PUT", url: `/api/admin/venues/${venueId}`, payload: {} });
    const room = await app.inject({ method: "PUT", url: `/api/admin/rooms/${roomId}`, payload: {} });

    expect(venue.statusCode).toBe(403);
    expect(room.statusCode).toBe(403);
  });
});
