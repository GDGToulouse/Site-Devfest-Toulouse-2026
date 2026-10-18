import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

// #662 — the brochure form mails a confirmation to whatever address it is given,
// unverified. Two caps keep it from being used to flood an inbox: one mail an
// hour per address, three requests an hour per IP. Other categories are left alone.

const sent = vi.hoisted(() => ({ mails: [] as Array<{ to: string[] }> }));

vi.mock("../lib/email.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/email.js")>()),
  sendEmail: async (message: { to: string[] }) => {
    sent.mails.push(message);
  },
}));
vi.mock("../lib/contact-webhook.js", () => ({ sendContactWebhook: async () => {} }));

const { default: contactRoutes } = await import("../routes/contact.js");
const { prisma } = await import("../lib/prisma.js");

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const app = Fastify({ logger: false });
await app.register(contactRoutes, { prefix: "/api" });

const brochure = await prisma.contactCategory.findFirstOrThrow({ where: { slug: "sponsor-brochure" } });
const general = await prisma.contactCategory.findFirstOrThrow({ where: { isActive: true, isPublic: true, slug: { not: "sponsor-brochure" } } });

let counter = 0;
const address = (label = "person") => `caps-${stamp}-${label}-${++counter}@example.test`;

function submit(email: string, ip: string, categoryId: number | null = brochure.id, extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/contact/send",
    remoteAddress: ip,
    payload: {
      firstName: "Ada",
      lastName: "Lovelace",
      email,
      company: "Analytical Engines",
      jobTitle: "CTO",
      message: "Please send me the sponsor brochure.",
      locale: "fr",
      ...(categoryId !== null && { categoryId }),
      ...extra,
    },
  });
}

const mailsTo = (email: string) => sent.mails.filter((m) => m.to.some((to) => to.toLowerCase() === email.toLowerCase())).length;
const storedFor = (email: string) => prisma.contactMessage.count({ where: { email: { equals: email, mode: "insensitive" } } });

beforeEach(() => {
  sent.mails.length = 0;
});

afterAll(async () => {
  await prisma.contactMessage.deleteMany({ where: { email: { contains: `caps-${stamp}` } } });
  await app.close();
});

describe("brochure requests, per address (#662)", () => {
  it("should send nothing for a second request from the same address within the hour, and say so no differently", async () => {
    const email = address();

    const first = await submit(email, "198.51.100.1");
    const second = await submit(email, "198.51.100.2");

    expect(first.json()).toEqual({ success: true });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ success: true });
    expect(mailsTo(email)).toBe(1);
    expect(await storedFor(email)).toBe(1);
  });

  it("should read the same address whatever its case", async () => {
    const email = address("case");

    await submit(email, "198.51.100.3");
    await submit(email.toUpperCase(), "198.51.100.4");

    expect(mailsTo(email)).toBe(1);
    expect(await storedFor(email)).toBe(1);
  });

  it("should send again once the hour is over", async () => {
    const email = address("later");
    await submit(email, "198.51.100.5");
    await prisma.contactMessage.updateMany({
      where: { email },
      data: { createdAt: new Date(Date.now() - 61 * 60 * 1000) },
    });

    await submit(email, "198.51.100.6");

    expect(mailsTo(email)).toBe(2);
  });

  it("should send only once for two requests for one address that arrive together", async () => {
    const email = address("race");

    await Promise.all([submit(email, "198.51.100.7"), submit(email, "198.51.100.8")]);

    expect(mailsTo(email)).toBe(1);
    expect(await storedFor(email)).toBe(1);
  });
});

describe("brochure requests, per IP (#662)", () => {
  it("should refuse the fourth request from one IP within the hour", async () => {
    const ip = "198.51.100.20";
    const emails = [address("ip"), address("ip"), address("ip"), address("ip")];

    const answers = [];
    for (const email of emails) answers.push((await submit(email, ip)).statusCode);

    expect(answers).toEqual([200, 200, 200, 429]);
    expect(mailsTo(emails[3])).toBe(0);
    expect(await storedFor(emails[3])).toBe(0);
  });

  it("should count each IP on its own", async () => {
    for (let i = 0; i < 3; i++) await submit(address("busy"), "198.51.100.21");

    const other = await submit(address("calm"), "198.51.100.22");

    expect(other.statusCode).toBe(200);
  });

  it("should not spend the budget on a request that was refused as invalid", async () => {
    const ip = "198.51.100.23";
    for (let i = 0; i < 4; i++) await submit("not-an-address", ip);

    const valid = await submit(address("valid"), ip);

    expect(valid.statusCode).toBe(200);
  });
});

describe("other categories (#662)", () => {
  it("should not cap the same address, nor the IP, outside the brochure", async () => {
    const ip = "198.51.100.30";
    const email = address("general");

    const answers = [];
    for (let i = 0; i < 5; i++) answers.push((await submit(email, ip, general.id)).statusCode);

    expect(answers).toEqual([200, 200, 200, 200, 200]);
    expect(await storedFor(email)).toBe(5);
  });

  it("should not cap a request without any category", async () => {
    const ip = "198.51.100.31";
    const email = address("none");

    const answers = [];
    for (let i = 0; i < 4; i++) answers.push((await submit(email, ip, null)).statusCode);

    expect(answers).toEqual([200, 200, 200, 200]);
  });
});
