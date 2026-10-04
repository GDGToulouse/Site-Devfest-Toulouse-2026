import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "../lib/prisma.js";
import { runInContext, type RequestContext } from "../lib/request-context.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #513 — the extension, not the routes, writes the history. Each case asserts
// the AuditLog rows actually stored, read back from the database.

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let actorId: string;
let context: RequestContext;

const created = {
  userIds: [] as string[],
  speakerIds: [] as number[],
  articleIds: [] as number[],
  keyFigureIds: [] as number[],
};

function inAdmin<T>(fn: () => Promise<T>): Promise<T> {
  // A fresh object per call: the context is mutable, and sharing one would let
  // a case leak its channel into the next.
  return runInContext({ ...context, actor: context.actor && { ...context.actor } }, async () => await fn());
}

async function logsFor(entity: string, id: number | string) {
  return prisma.auditLog.findMany({ where: { entity, entityId: String(id) }, orderBy: { id: "asc" } });
}

async function createSpeaker(extra: Record<string, unknown> = {}) {
  const speaker = await inAdmin(() =>
    prisma.speaker.create({ data: { name: "Ada Audit", slug: `ada-audit-${stamp()}`, ...extra } }),
  );
  created.speakerIds.push(speaker.id);
  return speaker;
}

beforeAll(async () => {
  const actor = await prisma.user.create({
    data: { email: `audit-actor-${stamp()}@example.org`, name: "Ed Auditor", role: "EDITOR" },
  });
  created.userIds.push(actor.id);
  actorId = actor.id;
  context = { channel: "ADMIN", actor: { userId: actor.id, label: "Ed Auditor" }, ip: "203.0.113.7" };
});

afterAll(async () => {
  if (created.keyFigureIds.length) await prisma.keyFigure.deleteMany({ where: { id: { in: created.keyFigureIds } } });
  if (created.articleIds.length) await prisma.article.deleteMany({ where: { id: { in: created.articleIds } } });
  if (created.speakerIds.length) await prisma.speaker.deleteMany({ where: { id: { in: created.speakerIds } } });
  // The user cascades to its API keys, which log nothing on the way out.
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  // Last, so the teardown's own DELETE lines go too.
  const entityIds = [...created.speakerIds, ...created.articleIds, ...created.keyFigureIds, ...created.userIds];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds.map(String) } } });
});

describe("audit log extension (#513)", () => {
  it("should record an update with the field before and after, the actor and the channel", async () => {
    const speaker = await createSpeaker();

    await inAdmin(() => prisma.speaker.update({ where: { id: speaker.id }, data: { name: "Ada Lovelace" } }));

    const update = (await logsFor("Speaker", speaker.id)).find((row) => row.action === "UPDATE");
    expect(update).toMatchObject({
      channel: "ADMIN",
      actorUserId: actorId,
      actorLabel: "Ed Auditor",
      ip: "203.0.113.7",
      changes: { name: { before: "Ada Audit", after: "Ada Lovelace" } },
    });
  });

  it("should tell create, trash and restore apart", async () => {
    const article = await inAdmin(() =>
      prisma.article.create({
        data: { slug: `audit-${stamp()}`, titleFr: "Audit", titleEn: "Audit", contentFr: "", contentEn: "" },
      }),
    );
    created.articleIds.push(article.id);

    await inAdmin(() => prisma.article.update({ where: { id: article.id }, data: { deletedAt: new Date() } }));
    await inAdmin(() => prisma.article.update({ where: { id: article.id }, data: { deletedAt: null } }));

    expect((await logsFor("Article", article.id)).map((row) => row.action)).toEqual(["CREATE", "TRASH", "RESTORE"]);
  });

  it("should record one line per record touched by a bulk update", async () => {
    const speakers = [await createSpeaker(), await createSpeaker(), await createSpeaker()];
    const ids = speakers.map((s) => s.id);

    await inAdmin(() => prisma.speaker.updateMany({ where: { id: { in: ids } }, data: { company: "Bulk Co" } }));

    const updates = await prisma.auditLog.findMany({
      where: { entity: "Speaker", entityId: { in: ids.map(String) }, action: "UPDATE" },
    });
    expect(updates).toHaveLength(3);
    expect(updates[0].changes).toEqual({ company: { before: null, after: "Bulk Co" } });
  });

  it("should record each row of a createMany, which Prisma reports as a bare count", async () => {
    const edition = await getSeededEdition();
    const label = `audit-${stamp()}`;

    const result = await inAdmin(() =>
      prisma.keyFigure.createMany({
        data: [
          { icon: "users", value: "1", labelFr: label, labelEn: label, editionId: edition.id },
          { icon: "users", value: "2", labelFr: label, labelEn: label, editionId: edition.id },
        ],
      }),
    );
    const rows = await prisma.keyFigure.findMany({ where: { labelFr: label } });
    created.keyFigureIds.push(...rows.map((r) => r.id));

    expect(result).toEqual({ count: 2 });
    const creates = await prisma.auditLog.findMany({
      where: { entity: "KeyFigure", entityId: { in: rows.map((r) => String(r.id)) }, action: "CREATE" },
    });
    expect(creates).toHaveLength(2);
  });

  it("should never store a secret, only that it changed", async () => {
    const speaker = await createSpeaker({ editToken: `secret-${stamp()}` });
    const newToken = `secret-${stamp()}`;

    await inAdmin(() => prisma.speaker.update({ where: { id: speaker.id }, data: { editToken: newToken } }));

    const rows = await logsFor("Speaker", speaker.id);
    expect(JSON.stringify(rows.map((row) => row.changes))).not.toContain("secret-");
    expect(rows.find((row) => row.action === "UPDATE")?.changes).toEqual({
      editToken: { before: "masqué", after: "masqué" },
    });
  });

  it("should not log the API key heartbeat nor sessions", async () => {
    const key = await prisma.apiKey.create({
      data: { name: "audit", prefix: `audit_${stamp()}`, hashedKey: "x", userId: actorId },
    });
    const session = await prisma.session.create({
      data: { token: `audit-${stamp()}`, userId: actorId, expiresAt: new Date(Date.now() + 60_000) },
    });

    await inAdmin(() => prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }));

    expect(await logsFor("ApiKey", key.id).then((rows) => rows.map((r) => r.action))).toEqual(["CREATE"]);
    expect(await logsFor("Session", session.id)).toEqual([]);
  });

  it("should not log an update that changes nothing", async () => {
    const speaker = await createSpeaker();

    await inAdmin(() => prisma.speaker.update({ where: { id: speaker.id }, data: { name: speaker.name } }));

    expect((await logsFor("Speaker", speaker.id)).map((row) => row.action)).toEqual(["CREATE"]);
  });

  it("should still find the record when the caller's select leaves its id out, without leaking the id", async () => {
    const slug = `audit-select-${stamp()}`;

    const result = await inAdmin(() =>
      prisma.speaker.create({ data: { name: "Sel Ect", slug }, select: { slug: true } }),
    );
    const speaker = await prisma.speaker.findUniqueOrThrow({ where: { slug } });
    created.speakerIds.push(speaker.id);

    expect(result).toEqual({ slug });
    expect((await logsFor("Speaker", speaker.id)).map((row) => row.action)).toEqual(["CREATE"]);
  });

  it("should file a write made outside any request under the system", async () => {
    const speaker = await prisma.speaker.create({ data: { name: "No Context", slug: `no-context-${stamp()}` } });
    created.speakerIds.push(speaker.id);

    expect(await logsFor("Speaker", speaker.id)).toMatchObject([
      { action: "CREATE", channel: "SYSTEM", actorUserId: null, actorLabel: "Système" },
    ]);
  });
});
