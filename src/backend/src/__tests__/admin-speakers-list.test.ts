process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import adminSpeakerRoutes from "../routes/admin/speakers.js";
import { prisma } from "../lib/prisma.js";

// #572 — the back-office speaker list asks the API for one page, filtered and
// sorted, and the edit token never leaves the server in an admin response.

// A year no other file uses, and a name prefix only these fixtures carry: the
// search filter scopes every request to them, whatever runs in parallel.
const YEAR = 1620;
const P = "Zq572";

let app: FastifyInstance;
let editionId: number;
const ids: Record<string, number> = {};

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminSpeakerRoutes, { prefix: "/api/admin" });

  const edition = await prisma.edition.create({ data: { year: YEAR, status: "SEE_YOU_NEXT_YEAR" } });
  editionId = edition.id;

  const make = async (key: string, data: Record<string, unknown>, status: "PUBLISHED" | "DRAFT") => {
    const speaker = await prisma.speaker.create({
      data: {
        slug: `${P.toLowerCase()}-${key}-${Date.now()}`,
        name: `${P} ${key}`,
        ...data,
        editions: { create: { editionId, publicationStatus: status } },
      },
    });
    ids[key] = speaker.id;
  };
  // Complete, published, link sent, one talk.
  await make("Ada", { company: "Beta Corp", photoUrl: "/a.jpg", bioFr: "Bio", contactEmail: "ada@example.com", editToken: `tok-${Date.now()}-a`, editTokenSentAt: new Date() }, "PUBLISHED");
  // Draft, no photo, no email, never sent, no talk.
  await make("Bob", { company: "Alpha", bioEn: "Bio" }, "DRAFT");
  // Draft, no company, no bio, link locked, two talks.
  await make("Cyd", { photoUrl: "/c.jpg", contactEmail: "cyd@example.com", editLinkLocked: true, editTokenSentAt: new Date() }, "DRAFT");

  await prisma.talk.create({
    data: { slug: `${P}-t1-${Date.now()}`, title: "T1", description: "", format: "CONFERENCE", language: "fr", editionId, speakers: { connect: [{ id: ids.Ada }] } },
  });
  for (const n of [2, 3]) {
    await prisma.talk.create({
      data: { slug: `${P}-t${n}-${Date.now()}`, title: `T${n}`, description: "", format: "CONFERENCE", language: "fr", editionId, speakers: { connect: [{ id: ids.Cyd }] } },
    });
  }
});

afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await prisma.edition.deleteMany({ where: { id: editionId } });
  await app.close();
});

async function list(query: Record<string, string>) {
  const params = new URLSearchParams({ search: P, editionId: String(editionId), ...query });
  return app.inject({ method: "GET", url: `/api/admin/speakers?${params}` });
}

const names = (body: { items: { name: string }[] }) => body.items.map((s) => s.name.replace(`${P} `, ""));

describe("Admin speakers list (#572)", () => {
  it("should page the list and say how many speakers match", async () => {
    const first = (await list({ page: "1", limit: "2" })).json();
    const second = (await list({ page: "2", limit: "2" })).json();

    expect(first).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(names(first)).toEqual(["Ada", "Bob"]);
    expect(names(second)).toEqual(["Cyd"]);
  });

  it("should keep the full array when no page is asked for", async () => {
    const body = (await list({})).json();

    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
  });

  it("should filter on the status of the chosen edition", async () => {
    expect(names((await list({ page: "1", status: "DRAFT" })).json())).toEqual(["Bob", "Cyd"]);
  });

  it("should find the speakers of the edition who have no talk on it", async () => {
    expect(names((await list({ page: "1", talks: "without" })).json())).toEqual(["Bob"]);
  });

  it("should find incomplete profiles, one criterion or several", async () => {
    expect(names((await list({ page: "1", missing: "email" })).json())).toEqual(["Bob"]);
    expect(names((await list({ page: "1", missing: "bio" })).json())).toEqual(["Cyd"]);
    expect(names((await list({ page: "1", missing: "photo,email" })).json())).toEqual(["Bob"]);
  });

  it("should filter on where the edit link stands", async () => {
    expect(names((await list({ page: "1", editLink: "never" })).json())).toEqual(["Bob"]);
    expect(names((await list({ page: "1", editLink: "sent" })).json())).toEqual(["Ada"]);
    expect(names((await list({ page: "1", editLink: "locked" })).json())).toEqual(["Cyd"]);
  });

  it("should sort by talk count, and keep speakers without a company last", async () => {
    expect(names((await list({ page: "1", sort: "talks", order: "desc" })).json())).toEqual(["Cyd", "Ada", "Bob"]);
    expect(names((await list({ page: "1", sort: "company", order: "asc" })).json())).toEqual(["Bob", "Ada", "Cyd"]);
    expect(names((await list({ page: "1", sort: "company", order: "desc" })).json())).toEqual(["Ada", "Bob", "Cyd"]);
  });

  it("should give each row its talk count, profile gaps and link state", async () => {
    const ada = (await list({ page: "1", search: `${P} Ada` })).json().items[0];

    expect(ada).toMatchObject({ talkCount: 1, status: "PUBLISHED", hasPhoto: true, hasBio: true, hasEmail: true, editLink: "sent" });
  });

  it("should never send the edit token, in the list or on the detail", async () => {
    const paged = await list({ page: "1" });
    const array = await list({});
    const detail = await app.inject({ method: "GET", url: `/api/admin/speakers/${ids.Ada}` });

    for (const res of [paged, array, detail]) expect(res.body).not.toContain("editToken\"");
    expect(detail.json()).not.toHaveProperty("editToken");
  });

  it("should refuse a status filter without an edition rather than guess the year", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/speakers?page=1&status=DRAFT&search=${P}` });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("edition_required");
  });
});
