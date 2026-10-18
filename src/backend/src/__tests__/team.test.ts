process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// The "Équipe" menu entry is on every page: each write purges the whole site.
vi.mock("../lib/revalidate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/revalidate.js")>()),
  revalidateAll: vi.fn().mockResolvedValue({ ok: true }),
}));

const { default: adminTeamRoutes } = await import("../routes/admin/team.js");
const { default: teamRoutes } = await import("../routes/team.js");
const { revalidateAll } = await import("../lib/revalidate.js");
const { prisma } = await import("../lib/prisma.js");

// #110 — the organisers' team: a member shared across editions, ticked for the
// years they organised, shown in alphabetical order of last name (RG-412).
// Tests on a past year of their own, so the featured edition's team and its
// menu flag never move while other suites run.
const TEST_YEAR = 1520;

let app: FastifyInstance;
let editionId: number;
const createdIds: number[] = [];

async function createMember(payload: Record<string, unknown>) {
  const res = await app.inject({ method: "POST", url: "/api/admin/team", payload: { editionIds: [editionId], ...payload } });
  if (res.statusCode === 201) createdIds.push(res.json().id);
  return res;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminTeamRoutes, { prefix: "/api/admin" });
  await app.register(teamRoutes, { prefix: "/api" });
  await app.ready();
  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR } })).id;
});

afterAll(async () => {
  await app.close();
  await prisma.teamMember.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.edition.delete({ where: { id: editionId } });
});

describe("Team (#110)", () => {
  it("lists the year's organisers by last name, with their links, and purges the site on a write", async () => {
    await createMember({ firstName: "Zoé", lastName: "Martin", linkedinUrl: "https://www.linkedin.com/in/zoe" });
    await createMember({ firstName: "Alice", lastName: "Émery", githubUrl: "https://github.com/alice" });
    await createMember({ firstName: "Bruno", lastName: "durand" });

    const res = await app.inject({ method: "GET", url: `/api/team?year=${TEST_YEAR}` });

    expect(res.json().year).toBe(TEST_YEAR);
    // French collation: "durand" before "Émery" before "Martin", case and accents aside.
    expect(res.json().members.map((m: { lastName: string }) => m.lastName)).toEqual(["durand", "Émery", "Martin"]);
    expect(res.json().members[1]).toMatchObject({ githubUrl: "https://github.com/alice", websiteUrl: null });
    expect(revalidateAll).toHaveBeenCalled();
  });

  it("keeps a member off a year they were not ticked for", async () => {
    const res = await createMember({ firstName: "Hors", lastName: "Année", editionIds: [] });

    const team = await app.inject({ method: "GET", url: `/api/team?year=${TEST_YEAR}` });

    expect(res.statusCode).toBe(201);
    expect(team.json().members.map((m: { id: number }) => m.id)).not.toContain(res.json().id);
  });

  it("refuses a link that is not http(s)", async () => {
    // eslint-disable-next-line no-script-url
    const res = await createMember({ firstName: "Mal", lastName: "Lien", websiteUrl: "javascript:alert(1)" });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_field", field: "websiteUrl" });
  });

  it("replaces the ticked years on update, and sends a deleted member to the trash", async () => {
    const created = (await createMember({ firstName: "Paul", lastName: "Partant" })).json();

    const updated = await app.inject({
      method: "PUT",
      url: `/api/admin/team/${created.id}`,
      payload: { firstName: "Paul", lastName: "Partant", editionIds: [] },
    });
    const del = await app.inject({ method: "DELETE", url: `/api/admin/team/${created.id}` });
    const stored = await prisma.teamMember.findUniqueOrThrow({ where: { id: created.id } });

    expect(updated.json().editions).toEqual([]);
    expect(del.statusCode).toBe(204);
    expect(stored.deletedAt).toBeInstanceOf(Date);
  });
});
