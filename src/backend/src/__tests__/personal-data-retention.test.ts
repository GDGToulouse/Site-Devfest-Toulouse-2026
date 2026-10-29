import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "../lib/prisma.js";
import { runPersonalDataAnonymization } from "../lib/scheduler.js";

// #666 — contact messages and the messages left to speakers were kept forever.
// Past a year, a daily task empties what names or quotes a person, and keeps
// what the statistics need: the category, the date, the votes.

const YEAR = 1581;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const PERSONAL = {
  firstName: "Dominique",
  lastName: "Ancienne",
  email: `dominique-${stamp()}@example.org`,
  phone: "+33 6 98 76 54 32",
  company: "Vieille Maison",
  jobTitle: "Gérante",
  message: "Un message écrit il y a longtemps.",
};

const log = { info: vi.fn(), error: vi.fn() };
const ids = { old: 0, recent: 0, oldFeedback: 0, recentFeedback: 0 };
let talkId: number | undefined;

beforeAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  const edition = await prisma.edition.create({ data: { year: YEAR, startDate: daysAgo(400), endDate: daysAgo(400) } });
  const talk = await prisma.talk.create({
    data: { editionId: edition.id, slug: `retention-${stamp()}`, title: "Retention", description: "", format: "CONFERENCE", language: "fr" },
  });
  talkId = talk.id;

  const contact = (createdAt: Date) =>
    prisma.contactMessage.create({ data: { ...PERSONAL, categoryLabel: "Sponsoring", createdAt } });
  ids.old = (await contact(daysAgo(400))).id;
  ids.recent = (await contact(daysAgo(200))).id;

  const feedback = (voterId: string, messageAt: Date) =>
    prisma.talkFeedback.create({
      data: { talkId: talk.id, voterId, items: ["learned"], message: "Merci, signé Dominique", messageAt, createdAt: messageAt },
    });
  ids.oldFeedback = (await feedback(`old-${stamp()}`, daysAgo(400))).id;
  ids.recentFeedback = (await feedback(`recent-${stamp()}`, daysAgo(30))).id;
});

afterAll(async () => {
  const contactIds = [ids.old, ids.recent].filter(Boolean);
  if (contactIds.length) {
    await prisma.contactMessage.deleteMany({ where: { id: { in: contactIds } } });
    await prisma.auditLog.deleteMany({ where: { entity: "ContactMessage", entityId: { in: contactIds.map(String) } } });
  }
  // The edition cascades to its talk and the talk to its feedback.
  await prisma.edition.deleteMany({ where: { year: YEAR } });
});

describe("personal data retention (#666)", () => {
  it("should anonymise a contact message past a year, and keep its category and date", async () => {
    await runPersonalDataAnonymization(log);

    const old = await prisma.contactMessage.findUniqueOrThrow({ where: { id: ids.old } });
    expect(old).toMatchObject({ lastName: "", email: "", phone: null, company: "", jobTitle: "", message: "" });
    expect(old.firstName).not.toBe(PERSONAL.firstName);
    expect(old.categoryLabel).toBe("Sponsoring");
    expect(old.createdAt.getTime()).toBeLessThan(daysAgo(365).getTime());
  });

  it("should leave a contact message younger than a year untouched", async () => {
    await runPersonalDataAnonymization(log);

    const recent = await prisma.contactMessage.findUniqueOrThrow({ where: { id: ids.recent } });
    expect(recent).toMatchObject(PERSONAL);
  });

  it("should empty the free text of an old feedback, and keep its votes", async () => {
    await runPersonalDataAnonymization(log);

    const old = await prisma.talkFeedback.findUniqueOrThrow({ where: { id: ids.oldFeedback } });
    expect(old.message).toBeNull();
    expect(old.items).toEqual(["learned"]);
    const recent = await prisma.talkFeedback.findUniqueOrThrow({ where: { id: ids.recentFeedback } });
    expect(recent.message).toBe("Merci, signé Dominique");
  });

  it("should sign the history as the scheduled task, without copying what it erased", async () => {
    await runPersonalDataAnonymization(log);

    const lines = await prisma.auditLog.findMany({ where: { entity: "ContactMessage", entityId: String(ids.old), action: "UPDATE" } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ channel: "SYSTEM", actorLabel: "Anonymisation des données personnelles", ip: null });
    const serialized = JSON.stringify(lines[0].changes);
    expect(Object.values(PERSONAL).filter((value) => serialized.includes(value))).toEqual([]);
    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ retentionMonths: 12 }), "Personal data anonymized");
  });
});
