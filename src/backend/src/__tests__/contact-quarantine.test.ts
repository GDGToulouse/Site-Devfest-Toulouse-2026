import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

// #767 — a suspicious contact message is stored but nothing leaves: no mail to
// the team, no confirmation to the given address, no webhook with its link.
// One content-free alert goes out, and releasing it from the admin sends
// everything, once.

const sent = vi.hoisted(() => ({
  mails: [] as Array<{ to: string[] }>,
  webhooks: [] as Array<{ id: number }>,
  alerts: 0,
}));

vi.mock("../lib/email.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/email.js")>()),
  sendEmail: async (message: { to: string[] }) => {
    sent.mails.push(message);
  },
}));
vi.mock("../lib/contact-webhook.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/contact-webhook.js")>()),
  sendContactWebhook: async (payload: { id: number }) => {
    sent.webhooks.push(payload);
    return { status: "success", error: null };
  },
}));
vi.mock("../lib/contact-quarantine-alert.js", () => ({
  sendQuarantineAlert: async () => {
    sent.alerts += 1;
    return { status: "success", error: null };
  },
}));
vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => ({
    user: { id: "test-admin", email: "admin@test.local", name: "Test", role: "ADMIN" },
  }),
}));

const { default: contactRoutes } = await import("../routes/contact.js");
const { buildAdminApp } = await import("./test-admin-app.js");
const { prisma } = await import("../lib/prisma.js");

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const app = Fastify({ logger: false });
await app.register(contactRoutes, { prefix: "/api" });
const admin = await buildAdminApp();

const brochure = await prisma.contactCategory.findFirstOrThrow({ where: { slug: "sponsor-brochure" } });

let counter = 0;
const address = (domain = "example.test") => `quarantine-${stamp}-${++counter}@${domain}`;

const PHISHING =
  "Une journée de conférences web, cloud, IA et sécurité pour développeurs, le 19 novembre. Les tarifs de sponsoring Gold et la disponibilité d'un stand, dossier ici : https://partagepro.online/fr/med/devfesttoulouse";

function submit(email: string, extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/contact/send",
    // Each submission its own IP: the brochure cap allows three an hour per IP.
    remoteAddress: `198.51.100.${counter}`,
    payload: {
      firstName: "Claire",
      lastName: "Dubois",
      email,
      company: "Analytical Engines",
      jobTitle: "CTO",
      message: "Bonjour, pouvez-vous m'envoyer la plaquette sponsor ? Merci.",
      locale: "fr",
      categoryId: brochure.id,
      ...extra,
    },
  });
}

const storedFor = (email: string) => prisma.contactMessage.findFirstOrThrow({ where: { email } });
const mailsTo = (email: string) => sent.mails.filter((m) => m.to.includes(email)).length;

beforeEach(() => {
  sent.mails.length = 0;
  sent.webhooks.length = 0;
  sent.alerts = 0;
});

afterAll(async () => {
  await prisma.contactMessage.deleteMany({ where: { email: { contains: `quarantine-${stamp}` } } });
  await app.close();
  await admin.close();
});

describe("POST /api/contact/send — quarantine (#767)", () => {
  it("should hold the phishing received, send nothing, and answer like a success", async () => {
    const email = address("prodmail.online");

    const response = await submit(email, { message: PHISHING, company: "Événements Tech", jobTitle: "Partenariats" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    const stored = await storedFor(email);
    expect(stored.quarantinedAt).not.toBeNull();
    expect(stored.spamReasons).toEqual(["external_link", "risky_tld:.online", "site_pitch"]);
    expect(sent.mails).toEqual([]);
    expect(sent.webhooks).toEqual([]);
    expect(sent.alerts).toBe(1);
  });

  it("should hold a link in the name, and never mail the given address", async () => {
    const email = address();

    await submit(email, { lastName: "partagepro.online/offre" });

    expect((await storedFor(email)).quarantinedAt).not.toBeNull();
    expect(mailsTo(email)).toBe(0);
    expect(sent.mails).toEqual([]);
  });

  it("should deliver an ordinary brochure request as before", async () => {
    const email = address();

    const response = await submit(email);

    expect(response.json()).toEqual({ success: true });
    const stored = await storedFor(email);
    expect(stored.quarantinedAt).toBeNull();
    expect(stored.spamScore).toBe(0);
    expect(mailsTo(email)).toBe(1);
    expect(sent.webhooks.map((w) => w.id)).toEqual([stored.id]);
    expect(sent.alerts).toBe(0);
  });
});

describe("admin — quarantined messages (#767)", () => {
  it("should keep them out of the inbox and list them under the quarantine filter", async () => {
    const email = address("prodmail.online");
    await submit(email, { message: PHISHING });
    const stored = await storedFor(email);

    const inbox = await admin.inject({ method: "GET", url: "/api/admin/contact/messages?limit=100" });
    const quarantine = await admin.inject({ method: "GET", url: "/api/admin/contact/messages?filter=quarantine&limit=100" });

    expect(inbox.json().messages.map((m: { id: number }) => m.id)).not.toContain(stored.id);
    const listed = quarantine.json().messages.find((m: { id: number }) => m.id === stored.id);
    expect(listed).toMatchObject({ spamScore: 5, spamReasons: ["external_link", "risky_tld:.online", "site_pitch"] });
    expect(quarantine.json().quarantineCount).toBeGreaterThanOrEqual(1);
  });

  it("should send everything once on release, and refuse a second release", async () => {
    const email = address("prodmail.online");
    await submit(email, { message: PHISHING });
    const stored = await storedFor(email);

    const first = await admin.inject({ method: "POST", url: `/api/admin/contact/messages/${stored.id}/release` });
    const second = await admin.inject({ method: "POST", url: `/api/admin/contact/messages/${stored.id}/release` });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);
    // The team's mail and the confirmation, one webhook — and nothing more on the second click.
    expect(sent.mails).toHaveLength(2);
    expect(mailsTo(email)).toBe(1);
    expect(sent.webhooks.map((w) => w.id)).toEqual([stored.id]);
    const released = await storedFor(email);
    expect(released.quarantinedAt).toBeNull();
    expect(released.releasedAt).not.toBeNull();
    expect(released.spamScore).toBe(5);
  });

  it("should refuse to forward or re-send the webhook of a held message", async () => {
    const email = address("prodmail.online");
    await submit(email, { message: PHISHING });
    const stored = await storedFor(email);

    const forward = await admin.inject({
      method: "POST",
      url: `/api/admin/contact/messages/${stored.id}/forward`,
      payload: { emails: "someone@example.test" },
    });
    const retry = await admin.inject({ method: "POST", url: `/api/admin/contact/messages/${stored.id}/retry-webhook` });

    expect(forward.statusCode).toBe(409);
    expect(retry.statusCode).toBe(409);
    expect(sent.mails).toEqual([]);
    expect(sent.webhooks).toEqual([]);
  });

  it("should answer 404 when releasing a message that does not exist", async () => {
    const response = await admin.inject({ method: "POST", url: "/api/admin/contact/messages/999999999/release" });

    expect(response.statusCode).toBe(404);
  });
});
