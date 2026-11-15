process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminRoutes from "../routes/admin/index.js";
import { registerAuthRoutes } from "../plugins/auth-routes.js";
import { registerRequestContext } from "../lib/request-context.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";
import { prisma } from "../lib/prisma.js";
import { createAgentClient, createUserWithPassword, obtainAgentToken } from "./agent-test-helpers.js";

// #830 — an ADMIN's AI agent may set up the badges (counters, layout, design,
// the badge of each tier, the preview on made-up people), but never touch the
// people: attendees, printed badges, freeze, Billetweb writes, resets, who may
// open the event-day screens. Before, the whole reception refused agents, with
// a message about accounts and keys.

// A past year of its own (#292).
const TEST_YEAR = 1830;

let app: FastifyInstance;
let clientId: string;
let editionId: number;
let outsideTierId: number;
let adminToken: string;
let editorToken: string;
const userIds: string[] = [];

const RECEPTION_MESSAGE = /Réservé à une personne/;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("adminUser");
  registerRequestContext(app);
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await registerAuthRoutes(app);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.ready();
  clientId = await createAgentClient("Claude (badges)");

  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR } })).id;
  outsideTierId = (
    await prisma.ticketTier.create({
      data: { editionId, nameFr: "Speakers", nameEn: "Speakers", price: 0, sortOrder: 0, isOutsideFlow: true },
    })
  ).id;

  const admin = await createUserWithPassword("ADMIN", "Admin Badges 1830");
  const editor = await createUserWithPassword("EDITOR", "Éditeur Badges 1830");
  userIds.push(admin.id, editor.id);
  adminToken = await obtainAgentToken(app, clientId, admin.email);
  editorToken = await obtainAgentToken(app, clientId, editor.email);
});

afterAll(async () => {
  await app.close();
  if (editionId !== undefined) {
    await prisma.ticketTier.deleteMany({ where: { editionId } });
    await prisma.edition.delete({ where: { id: editionId } });
  }
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.oauthClient.delete({ where: { clientId } });
});

function call(token: string, method: "GET" | "PUT" | "POST", url: string, payload?: unknown) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
}

describe("AI agents and the badges (#830)", () => {
  it("should let an ADMIN's agent read the badge overview", async () => {
    const res = await call(adminToken, "GET", `/api/admin/badges/${editionId}`);

    expect(res.statusCode).toBe(200);
  });

  it("should let an ADMIN's agent save the counters and bins", async () => {
    const res = await call(adminToken, "PUT", `/api/admin/badges/${editionId}/settings`, {
      counters: 2,
      binsPerCounter: 3,
      badgesPerBin: 50,
      billetwebBadgeFieldId: null,
    });

    expect(res.statusCode).toBe(200);
  });

  it("should let an ADMIN's agent give a tier its badge type", async () => {
    const overview = (await call(adminToken, "GET", `/api/admin/badges/${editionId}`)).json();

    const res = await call(adminToken, "PUT", `/api/admin/badges/${editionId}/design`, {
      design: overview.design,
      tierTypes: [{ tierId: outsideTierId, badgeType: "SPEAKER" }],
    });

    expect(res.statusCode).toBe(200);
    const tier = await prisma.ticketTier.findUniqueOrThrow({ where: { id: outsideTierId } });
    expect(tier.badgeType).toBe("SPEAKER");
  });

  it("should let an ADMIN's agent get the preview on made-up people", async () => {
    const res = await call(adminToken, "GET", `/api/admin/badges/${editionId}/preview`);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/pdf/);
  });

  it.each([
    ["GET", "pdf", undefined],
    ["POST", "freeze", { confirm: true }],
    ["POST", "billetweb", undefined],
    ["POST", "unfreeze", { confirm: "ANNULER" }],
    ["POST", "reset", { confirm: "REINITIALISER" }],
  ] as const)("should refuse an ADMIN's agent %s badges/%s", async (method, action, payload) => {
    const res = await call(adminToken, method, `/api/admin/badges/${editionId}/${action}`, payload);

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toMatch(RECEPTION_MESSAGE);
  });

  it.each([
    ["attendees/summary"],
    ["attendees/list"],
    ["arrivals-access"],
    ["arrivals-stations"],
  ])("should refuse an ADMIN's agent the event-day people at %s", async (area) => {
    const res = await call(adminToken, "GET", `/api/admin/${area}/${editionId}`);

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toMatch(RECEPTION_MESSAGE);
    expect(res.json().message).not.toMatch(/comptes|clés/);
  });

  it("should keep an EDITOR's agent away from the badges", async () => {
    const res = await call(editorToken, "GET", `/api/admin/badges/${editionId}`);

    expect(res.statusCode).toBe(403);
  });
});
