process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminSpeakerRoutes from "../routes/admin/speakers.js";
import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// The URL fields of a speaker or a sponsor end up in `href` and `src` on public
// pages: the back-office holds them to the same allow-list as the speaker link
// and the partner space (#223), so a link cannot run script nor pass for an
// internal one.

let app: FastifyInstance;
let editionId: number;
let tierId: number;
const names: string[] = [];
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminSpeakerRoutes, { prefix: "/api/admin" });
  await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
  await app.ready();
  editionId = (await getSeededEdition()).id;
  tierId = await tierIdByKey("gold");
});

// Before the check, these calls created rows: remove whatever they left.
afterAll(async () => {
  await app.close();
  await prisma.speaker.deleteMany({ where: { name: { in: names } } });
  await prisma.sponsor.deleteMany({ where: { name: { in: names } } });
});

describe("back-office URL fields", () => {
  it("should refuse a speaker whose photo is a javascript: URL", async () => {
    const name = `Url Speaker ${stamp()}`;
    names.push(name);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId, name, photoUrl: "javascript:alert(1)" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("unsafe_url");
    expect(await prisma.speaker.count({ where: { name } })).toBe(0);
  });

  it("should refuse a speaker social link that leaves for another host", async () => {
    const name = `Url Speaker ${stamp()}`;
    names.push(name);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId, name, socialLinks: { github: "/\\evil.example" } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("unsafe_url");
    expect(await prisma.speaker.count({ where: { name } })).toBe(0);
  });

  it("should refuse a sponsor whose website is a javascript: URL", async () => {
    const name = `Url Sponsor ${stamp()}`;
    names.push(name);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sponsors",
      payload: { editionId, tierId, name, websiteUrl: "javascript:alert(1)" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("unsafe_url");
    expect(await prisma.sponsor.count({ where: { name } })).toBe(0);
  });
});
