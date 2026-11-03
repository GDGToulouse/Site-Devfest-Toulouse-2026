import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { runInContext } from "../lib/request-context.js";

// #665 — the history copied every contact message, name, e-mail and text
// included, with the visitor's IP, and kept it thirteen months: deleting a
// message on the person's request left two readable copies behind.

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const PERSONAL = {
  firstName: "Camille",
  lastName: "Privée",
  email: `camille-${stamp()}@example.org`,
  phone: "+33 6 12 34 56 78",
  company: "Secret SARL",
  jobTitle: "Directrice",
  message: "Bonjour, voici mon histoire personnelle.",
};

const messageIds: number[] = [];
const legacyLogIds: bigint[] = [];

function asVisitor<T>(fn: () => Promise<T>): Promise<T> {
  return runInContext({ channel: "PUBLIC", ip: "198.51.100.23" }, async () => await fn());
}

function asAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return runInContext(
    { channel: "ADMIN", actor: { userId: null, label: "Ed Admin" }, ip: "203.0.113.9" },
    async () => await fn(),
  );
}

async function logsFor(id: number) {
  return prisma.auditLog.findMany({ where: { entity: "ContactMessage", entityId: String(id) }, orderBy: { id: "asc" } });
}

function leaks(serialized: string): string[] {
  return Object.values(PERSONAL).filter((value) => serialized.includes(value));
}

afterAll(async () => {
  if (messageIds.length) {
    await prisma.contactMessage.deleteMany({ where: { id: { in: messageIds } } });
    await prisma.auditLog.deleteMany({ where: { entity: "ContactMessage", entityId: { in: messageIds.map(String) } } });
  }
  if (legacyLogIds.length) await prisma.auditLog.deleteMany({ where: { id: { in: legacyLogIds } } });
});

describe("contact messages in the history (#665)", () => {
  it("should record a new message without any personal value nor the visitor's IP", async () => {
    const message = await asVisitor(() => prisma.contactMessage.create({ data: { ...PERSONAL, categoryLabel: "Autre" } }));
    messageIds.push(message.id);

    const [create] = await logsFor(message.id);
    expect(create).toMatchObject({ action: "CREATE", channel: "PUBLIC", ip: null });
    expect(leaks(JSON.stringify(create.changes))).toEqual([]);
    // What changed stays readable: the field is there, its value is not.
    expect(create.changes).toMatchObject({ email: { before: null, after: "masqué" }, categoryLabel: { after: "Autre" } });
  });

  it("should keep the team's edits readable and leak nothing on trash and delete", async () => {
    const message = await asVisitor(() => prisma.contactMessage.create({ data: PERSONAL }));
    messageIds.push(message.id);

    await asAdmin(() => prisma.contactMessage.update({ where: { id: message.id }, data: { isRead: true } }));
    await asAdmin(() => prisma.contactMessage.update({ where: { id: message.id }, data: { deletedAt: new Date() } }));
    await asAdmin(() => prisma.contactMessage.delete({ where: { id: message.id } }));

    const logs = await logsFor(message.id);
    expect(logs.map((l) => l.action)).toEqual(["CREATE", "UPDATE", "TRASH", "DELETE"]);
    expect(logs[1].changes).toEqual({ isRead: { before: false, after: true } });
    expect(leaks(JSON.stringify(logs.map((l) => l.changes)))).toEqual([]);
    expect(logs.every((l) => l.ip === null)).toBe(true);
  });

  it("should clean the history written before the fix", async () => {
    // A line as the old extension wrote it: every value in clear, with the IP.
    const legacy = await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "ContactMessage",
        entityId: `legacy-${stamp()}`,
        channel: "PUBLIC",
        actorLabel: "Anonyme",
        ip: "198.51.100.42",
        changes: {
          ...Object.fromEntries(Object.entries(PERSONAL).map(([k, v]) => [k, { before: null, after: v }])),
          phone: { before: null, after: null },
          isRead: { before: null, after: false },
        },
      },
    });
    legacyLogIds.push(legacy.id);

    const sql = readFileSync(
      join(import.meta.dirname, "../../prisma/migrations/20261028110500_mask_contact_message_audit/migration.sql"),
      "utf8",
    );
    // Twice: the migration must be safe to replay on already masked rows.
    await prisma.$executeRawUnsafe(sql);
    await prisma.$executeRawUnsafe(sql);

    const cleaned = await prisma.auditLog.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(cleaned.ip).toBeNull();
    expect(leaks(JSON.stringify(cleaned.changes))).toEqual([]);
    expect(cleaned.changes).toMatchObject({
      email: { before: null, after: "masqué" },
      // An empty field stays empty, and a non-personal one keeps its value.
      phone: { before: null, after: null },
      isRead: { before: null, after: false },
    });
  });
});
