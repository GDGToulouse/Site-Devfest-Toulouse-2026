import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { hashLinkToken } from "../lib/edit-token.js";

// #567 — the recap of the audience feedback, sent to each speaker when an
// admin decides: real votes only, hidden messages left out, a fresh link to
// the details unless the team locked it. On an edition of its own (1540).

const sent: { to: string[]; subject: string; text: string; html: string }[] = [];
let failFor: string | null = null;
vi.mock("../lib/email.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/email.js")>()),
  sendEmail: vi.fn(async (mail: { to: string[]; subject: string; text: string; html: string }) => {
    if (failFor && mail.to.includes(failFor)) throw new Error("smtp down");
    sent.push(mail);
  }),
}));

const { default: adminFeedbackRoutes } = await import("../routes/admin/feedback.js");

const YEAR = 1540;
const tag = randomUUID().slice(0, 8);
const ADA = `ada-${tag}@example.com`;
const BOB = `bob-${tag}@example.com`;

let app: FastifyInstance;
let editionId: number;
const ids: Record<string, number> = {};

async function speaker(key: string, data: { name: string; contactEmail?: string; locale?: string; editLinkLocked?: boolean }) {
  const s = await prisma.speaker.create({ data: { slug: `recap-${key}-${tag}`, editToken: `old-${key}-${tag}`, ...data } });
  ids[key] = s.id;
  return s;
}

async function talk(key: string, speakerKeys: string[]) {
  const t = await prisma.talk.create({
    data: {
      editionId, slug: `recap-${key}-${tag}`, title: `Session ${key}`, description: "", format: "CONFERENCE", language: "fr",
      publicationStatus: "PUBLISHED", speakers: { connect: speakerKeys.map((k) => ({ id: ids[k] })) },
    },
  });
  ids[key] = t.id;
}

beforeAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  editionId = (await prisma.edition.create({ data: { year: YEAR, startDate: new Date("1540-11-19T00:00:00.000Z") } })).id;
  await speaker("ada", { name: "Ada", contactEmail: ADA });
  await speaker("bob", { name: "Bob", contactEmail: BOB, locale: "en" });
  await speaker("carl", { name: "Carl" });
  await speaker("dora", { name: "Dora", contactEmail: `dora-${tag}@example.com`, editLinkLocked: true });
  await speaker("eve", { name: "Eve", contactEmail: `eve-${tag}@example.com` });
  await talk("a", ["ada"]);
  await talk("b", ["bob"]);
  await talk("c", ["carl"]);
  await talk("d", ["dora"]);
  await talk("e", ["eve"]);

  const vote = (key: string, data: object) => prisma.talkFeedback.create({ data: { talkId: ids[key], voterId: randomUUID(), items: ["learned"], ...data } });
  await vote("a", { items: ["learned", "tooComplex"], message: "Bravo Ada", messageAt: new Date() });
  await vote("a", { message: "Message masqué", messageAt: new Date(), messageHidden: true });
  await vote("b", { items: ["fun"] });
  await vote("c", {});
  await vote("d", {});
  // Eve only has a vote from the trial: no recap for her.
  await vote("e", { isTest: true, message: "Vote de test", messageAt: new Date() });

  app = Fastify();
  await app.register(adminFeedbackRoutes, { prefix: "/api/admin" });
});

beforeEach(async () => {
  sent.length = 0;
  failFor = null;
  if (editionId !== undefined) await prisma.speakerFeedbackRecap.deleteMany({ where: { editionId } });
});

afterAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  await prisma.speaker.deleteMany({ where: { slug: { endsWith: tag } } });
  await app?.close();
});

const mailTo = (address: string) => sent.find((m) => m.to.includes(address));

describe("feedback recap (#567)", () => {
  it("should list the speakers with a real vote, their address, and nothing sent yet", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}/feedback-recap` });

    expect(res.json().speakers).toEqual([
      { id: ids.ada, name: "Ada", email: ADA, sentAt: null, failedAt: null },
      { id: ids.bob, name: "Bob", email: BOB, sentAt: null, failedAt: null },
      { id: ids.carl, name: "Carl", email: null, sentAt: null, failedAt: null },
      { id: ids.dora, name: "Dora", email: `dora-${tag}@example.com`, sentAt: null, failedAt: null },
    ]);
  });

  it("should send each speaker their results, negatives and visible messages only", async () => {
    const res = await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });

    expect(res.json()).toEqual({ sent: ["Ada", "Bob", "Dora"], withoutEmail: ["Carl"], failed: [] });
    const ada = mailTo(ADA)!;
    expect(ada.text).toContain("Trop complexe");
    expect(ada.text).toContain("Bravo Ada");
    expect(ada.text).not.toContain("Message masqué");
    expect(sent.some((m) => m.text.includes("Vote de test"))).toBe(false);
  });

  it("should write to an English-speaking speaker in English", async () => {
    await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });

    expect(mailTo(BOB)!.subject).toBe("DevFest Toulouse — what the audience thought of your session");
    expect(mailTo(BOB)!.text).toContain("Fun 😃");
  });

  it("should give a fresh link, but none to a speaker whose link is locked", async () => {
    await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });
    const ada = await prisma.speaker.findUnique({ where: { id: ids.ada } });
    const dora = await prisma.speaker.findUnique({ where: { id: ids.dora } });

    expect(ada?.editToken).not.toBe(`old-ada-${tag}`);
    // The mail carries the token, the row only its hash (#672).
    const mailed = mailTo(ADA)!.text.match(/\/edit\/([0-9a-f]{64})/)?.[1];
    expect(mailed).toBeDefined();
    expect(ada?.editToken).toBe(hashLinkToken(mailed!));
    expect(dora?.editToken).toBe(`old-dora-${tag}`);
    expect(mailTo(`dora-${tag}@example.com`)!.text).not.toContain("/edit/");
  });

  it("should report a failed send and keep that speaker's current link", async () => {
    const before = (await prisma.speaker.findUnique({ where: { id: ids.bob } }))?.editToken;
    failFor = BOB;
    const res = await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });

    expect(res.json().failed).toEqual(["Bob"]);
    expect((await prisma.speaker.findUnique({ where: { id: ids.bob } }))?.editToken).toBe(before);
  });

  it("should remember, speaker by speaker, that the recap was sent (#865)", async () => {
    await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });
    const res = await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}/feedback-recap` });

    const byName = Object.fromEntries(res.json().speakers.map((s: { name: string }) => [s.name, s]));
    expect(byName.Ada.sentAt).not.toBeNull();
    expect(byName.Carl.sentAt).toBeNull();
  });

  it("should not write twice to a speaker already served (#865)", async () => {
    await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });
    sent.length = 0;

    const res = await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });

    expect(res.json()).toEqual({ sent: [], withoutEmail: ["Carl"], failed: [] });
    expect(sent).toEqual([]);
  });

  it("should keep a failure on the speaker, and send it on the next click (#865)", async () => {
    failFor = BOB;
    await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });
    const afterFailure = await prisma.speakerFeedbackRecap.findUnique({ where: { editionId_speakerId: { editionId, speakerId: ids.bob } } });
    failFor = null;
    sent.length = 0;

    const res = await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });

    expect(afterFailure).toMatchObject({ sentAt: null, failedAt: expect.any(Date) });
    expect(res.json().sent).toEqual(["Bob"]);
    const afterRetry = await prisma.speakerFeedbackRecap.findUnique({ where: { editionId_speakerId: { editionId, speakerId: ids.bob } } });
    expect(afterRetry).toMatchObject({ sentAt: expect.any(Date), failedAt: null });
  });

  it("should send one speaker their recap again, and no one else (#865)", async () => {
    await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });
    sent.length = 0;

    const res = await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap/${ids.ada}` });

    expect(res.json()).toEqual({ sent: ["Ada"], withoutEmail: [], failed: [] });
    expect(sent.map((m) => m.to)).toEqual([[ADA]]);
  });

  it("should send a speaker given an address after the first send (#865)", async () => {
    await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });
    await prisma.speaker.update({ where: { id: ids.carl }, data: { contactEmail: `carl-${tag}@example.com` } });
    sent.length = 0;

    const res = await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap` });
    await prisma.speaker.update({ where: { id: ids.carl }, data: { contactEmail: null } });

    expect(res.json().sent).toEqual(["Carl"]);
  });

  it("should refuse to send to a speaker with no vote on the edition (#865)", async () => {
    const res = await app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/feedback-recap/${ids.eve}` });

    expect(res.statusCode).toBe(404);
  });
});
