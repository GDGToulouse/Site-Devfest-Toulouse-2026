process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminRoutes from "../routes/admin/index.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { purgeExpiredAuditLog } from "../lib/audit-purge.js";

// #513 — the history screen's API: ADMIN only, filtered, keyset-paginated,
// and kept 13 months. Rows are inserted directly so each case controls its data.

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MONTH_MS = 31 * 24 * 60 * 60 * 1000;

let app: FastifyInstance;
let adminBearer: string;
let editorBearer: string;
let speakerId: number;
// Marks every line this file writes, so filters and cleanup see only ours.
const entityId = `audit-api-${stamp()}`;
const created = { userIds: [] as string[] };

async function bearerFor(role: "ADMIN" | "EDITOR") {
  const user = await prisma.user.create({
    data: { email: `audit-api-${role.toLowerCase()}-${stamp()}@example.org`, name: role, role },
  });
  created.userIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({ data: { name: "audit-api", prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id } });
  return key.raw;
}

function line(data: Partial<Parameters<typeof prisma.auditLog.create>[0]["data"]> = {}) {
  return prisma.auditLog.create({
    data: { action: "UPDATE", entity: "AuditTest", entityId, channel: "ADMIN", actorLabel: "Test", ...data },
  });
}

function list(query: string, bearer = adminBearer) {
  return app.inject({ method: "GET", url: `/api/admin/audit?${query}`, headers: { authorization: `Bearer ${bearer}` } });
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("adminUser");
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.ready();

  adminBearer = await bearerFor("ADMIN");
  editorBearer = await bearerFor("EDITOR");
  const speaker = await prisma.speaker.create({ data: { name: "Lab El", slug: `lab-el-${stamp()}` } });
  speakerId = speaker.id;
});

afterAll(async () => {
  await app.close();
  await prisma.speaker.delete({ where: { id: speakerId } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [entityId, String(speakerId), ...created.userIds] } },
  });
});

describe("GET /api/admin/audit (#513)", () => {
  it("should refuse an editor: the history holds personal data", async () => {
    const res = await list(`entityId=${entityId}`, editorBearer);

    expect(res.statusCode).toBe(403);
  });

  it("should filter by channel", async () => {
    await line({ channel: "EDIT_LINK", actorLabel: "Speaker via link" });
    await line({ channel: "ADMIN" });

    const res = await list(`entity=AuditTest&entityId=${entityId}&channel=EDIT_LINK`);

    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((i: { actorLabel: string }) => i.actorLabel)).toEqual(["Speaker via link"]);
  });

  it("should page newest first with a cursor, and say when there is no more", async () => {
    const pageEntity = `${entityId}-page`;
    const first = await line({ entityId: pageEntity });
    const second = await line({ entityId: pageEntity });
    const third = await line({ entityId: pageEntity });

    const page1 = (await list(`entityId=${pageEntity}&limit=2`)).json();
    const page2 = (await list(`entityId=${pageEntity}&limit=2&before=${page1.nextCursor}`)).json();
    await prisma.auditLog.deleteMany({ where: { entityId: pageEntity } });

    expect(page1.items.map((i: { id: string }) => i.id)).toEqual([third.id.toString(), second.id.toString()]);
    expect(page2.items.map((i: { id: string }) => i.id)).toEqual([first.id.toString()]);
    expect(page2.nextCursor).toBeNull();
  });

  it("should keep only the lines inside the requested period", async () => {
    const periodEntity = `${entityId}-period`;
    await line({ entityId: periodEntity, createdAt: new Date("2026-01-10T10:00:00Z"), actorLabel: "January" });
    await line({ entityId: periodEntity, createdAt: new Date("2026-03-10T10:00:00Z"), actorLabel: "March" });

    const res = await list(
      `entityId=${periodEntity}&from=2026-02-01T00:00:00.000Z&to=2026-04-01T00:00:00.000Z`,
    );
    await prisma.auditLog.deleteMany({ where: { entityId: periodEntity } });

    expect(res.json().items.map((i: { actorLabel: string }) => i.actorLabel)).toEqual(["March"]);
  });

  it("should name the record by its current label", async () => {
    await line({ entity: "Speaker", entityId: String(speakerId) });

    const res = await list(`entity=Speaker&entityId=${speakerId}`);

    expect(res.json().items[0]).toMatchObject({ entityLabel: "Lab El", changes: null });
  });
});

describe("audit log retention (#513)", () => {
  it("should purge lines older than 13 months and keep a 12-month-old one", async () => {
    const now = Date.now();
    const old = await line({ createdAt: new Date(now - 14 * MONTH_MS) });
    const recent = await line({ createdAt: new Date(now - 12 * MONTH_MS) });

    await purgeExpiredAuditLog();

    expect(await prisma.auditLog.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });
});
