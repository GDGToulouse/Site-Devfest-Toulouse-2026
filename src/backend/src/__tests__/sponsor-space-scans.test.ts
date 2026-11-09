process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import sponsorSpaceScanRoutes from "../routes/sponsor-space-scans.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { findCurrentEdition } from "../lib/arrivals-access.js";
import { createSponsorFixture } from "./sponsor-test-helpers.js";

// #813 — a sponsor's booth scans badges and finds the people it met. The scans
// work on the current edition, which other suites read too: this file adds its
// own attendees under codes of its own and removes them, and creates no edition.

let app: FastifyInstance;
let editionId: number;
let tierId: number;

const RUN = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
const CODE = (name: string) => `sponsor-scan-${RUN}-${name}`;
const created = { userIds: [] as string[], sponsorIds: [] as number[] };
let seq = 0;

async function attendee(code: string, data: Record<string, unknown> = {}) {
  seq += 1;
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: `${CODE("bw")}-${seq}`,
      barcode: code,
      firstName: "Inès",
      lastName: `Stand${seq}`,
      email: `ines${seq}@example.org`,
      company: "Cassoulet SA",
      billetwebTicketId: "t1",
      orderId: `${CODE("order")}-${seq}`,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      ...data,
    },
  });
}

async function account(email: string, role: "SPONSOR" | "ADMIN" = "SPONSOR") {
  const user = await prisma.user.create({ data: { email, name: `Nom ${email}`, role, emailVerified: true } });
  created.userIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({ data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id } });
  return { user, headers: { authorization: `Bearer ${key.raw}` } };
}

async function booth(accessRole: "RESPONSABLE" | "EDITEUR" | "STAND", inEdition = true) {
  seq += 1;
  const slug = `scan-co-${RUN}-${seq}`;
  const sponsor = inEdition
    ? await createSponsorFixture({ name: `Scan Co ${seq}`, slug, editionId, tierId })
    : await prisma.sponsor.create({ data: { name: `Scan Co ${seq}`, slug } });
  created.sponsorIds.push(sponsor.id);
  const { user, headers } = await account(`scan-${RUN}-${seq}@example.org`);
  await prisma.sponsorContact.create({ data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole } });
  return { sponsor, headers };
}

const scan = (sponsorId: number, headers: Record<string, string>, code: string) =>
  app.inject({ method: "POST", url: `/api/sponsor-space/${sponsorId}/scans`, headers, payload: { code } });
const list = (sponsorId: number, headers: Record<string, string>) =>
  app.inject({ method: "GET", url: `/api/sponsor-space/${sponsorId}/scans`, headers });
const exportCsv = (sponsorId: number, headers: Record<string, string>) =>
  app.inject({ method: "GET", url: `/api/sponsor-space/${sponsorId}/scans/export`, headers });

beforeAll(async () => {
  editionId = (await findCurrentEdition())!.id;
  tierId = (await prisma.sponsorTier.findFirstOrThrow({ select: { id: true } })).id;
  await attendee(CODE("live"), { firstName: "Hélène", lastName: "Martin", email: "helene@example.org" });
  await attendee(CODE("cancelled"), { isCancelled: true });
  // An exchange: the cancelled ticket and the live one share the code.
  await attendee(CODE("exchange"), { isCancelled: true, firstName: "Ancien" });
  await attendee(CODE("exchange"), { firstName: "Nouveau" });

  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(sponsorSpaceScanRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  if (editionId !== undefined) {
    await prisma.attendee.deleteMany({ where: { editionId, barcode: { startsWith: `sponsor-scan-${RUN}-` } } });
  }
  if (created.userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
  // The scans go with their sponsor (cascade).
  if (created.sponsorIds.length) await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
});

describe("Sponsor badge scans — access (#813)", () => {
  it("should let every role of the sponsor scan, STAND included", async () => {
    for (const role of ["STAND", "EDITEUR", "RESPONSABLE"] as const) {
      const { sponsor, headers } = await booth(role);
      const res = await scan(sponsor.id, headers, CODE("live"));
      expect([role, res.statusCode]).toEqual([role, 201]);
    }
  });

  it("should refuse a contact of another sponsor, as if the sponsor did not exist", async () => {
    const { sponsor } = await booth("RESPONSABLE");
    const { headers: stranger } = await booth("RESPONSABLE");

    const res = await list(sponsor.id, stranger);

    expect(res.statusCode).toBe(404);
  });

  it("should refuse an anonymous caller", async () => {
    const { sponsor } = await booth("STAND");

    const res = await app.inject({ method: "POST", url: `/api/sponsor-space/${sponsor.id}/scans`, payload: { code: CODE("live") } });

    expect(res.statusCode).toBe(401);
  });

  it("should refuse a sponsor that does not take part in the current edition", async () => {
    const { sponsor, headers } = await booth("RESPONSABLE", false);

    const res = await scan(sponsor.id, headers, CODE("live"));

    expect([res.statusCode, res.json().error]).toEqual([422, "no_current_participation"]);
  });
});

describe("Sponsor badge scans — what a scan shows (#813)", () => {
  it("should show the person behind a live ticket, never the code nor the email", async () => {
    const { sponsor, headers } = await booth("STAND");

    const res = await scan(sponsor.id, headers, CODE("live"));

    expect(res.json()).toMatchObject({
      isDuplicate: false,
      scan: { attendee: { firstName: "Hélène", lastName: "Martin", company: "Cassoulet SA" }, code: null },
    });
    expect(JSON.stringify(res.json())).not.toContain("helene@example.org");
  });

  it("should show an unknown code as read, and keep it in the list", async () => {
    const { sponsor, headers } = await booth("STAND");

    const res = await scan(sponsor.id, headers, "https://example.org/not-a-badge");
    const rows = (await list(sponsor.id, headers)).json().scans;

    expect(res.json().scan).toMatchObject({ attendee: null, code: "https://example.org/not-a-badge" });
    expect(rows).toHaveLength(1);
  });

  it("should show a cancelled ticket as an unknown code", async () => {
    const { sponsor, headers } = await booth("STAND");

    const res = await scan(sponsor.id, headers, CODE("cancelled"));

    expect(res.json().scan).toMatchObject({ attendee: null, code: CODE("cancelled") });
  });

  it("should name the live ticket when a cancelled one shares its code", async () => {
    const { sponsor, headers } = await booth("STAND");

    const res = await scan(sponsor.id, headers, CODE("exchange"));

    expect(res.json().scan.attendee.firstName).toBe("Nouveau");
  });

  it("should keep one line for a badge scanned twice, and say so", async () => {
    const { sponsor, headers } = await booth("STAND");

    await scan(sponsor.id, headers, CODE("live"));
    const again = await scan(sponsor.id, headers, CODE("live"));
    const rows = (await list(sponsor.id, headers)).json().scans;

    expect([again.statusCode, again.json().isDuplicate]).toEqual([200, true]);
    expect(rows).toHaveLength(1);
  });

  it("should refuse an empty code", async () => {
    const { sponsor, headers } = await booth("STAND");

    const res = await scan(sponsor.id, headers, "   ");

    expect(res.statusCode).toBe(400);
  });
});

describe("Sponsor badge scans — the list follows the attendees (#813)", () => {
  it("should share the scans within the sponsor's team, and only there", async () => {
    const { sponsor, headers } = await booth("STAND");
    const { user: colleague, headers: colleagueHeaders } = await account(`colleague-${RUN}@example.org`);
    await prisma.sponsorContact.create({ data: { sponsorId: sponsor.id, email: colleague.email, userId: colleague.id, accessRole: "EDITEUR" } });
    const { sponsor: other, headers: otherHeaders } = await booth("STAND");

    await scan(sponsor.id, headers, CODE("live"));
    const mine = (await list(sponsor.id, colleagueHeaders)).json().scans;
    const theirs = (await list(other.id, otherHeaders)).json().scans;

    expect(mine).toHaveLength(1);
    expect(mine[0].scannedBy).toMatch(/^Nom scan-/);
    expect(theirs).toEqual([]);
  });

  it("should show a ticket as it is now: corrected, then cancelled after the scan", async () => {
    const { sponsor, headers } = await booth("STAND");
    const person = await attendee(CODE("changing"), { firstName: "Avant" });
    await scan(sponsor.id, headers, CODE("changing"));

    await prisma.attendee.update({ where: { id: person.id }, data: { firstName: "Après" } });
    const corrected = (await list(sponsor.id, headers)).json().scans[0];
    await prisma.attendee.update({ where: { id: person.id }, data: { isCancelled: true } });
    const cancelled = (await list(sponsor.id, headers)).json().scans[0];

    expect(corrected.attendee.firstName).toBe("Après");
    expect(cancelled).toMatchObject({ attendee: null, code: CODE("changing") });
  });

  it("should recognise a code scanned before its ticket was imported", async () => {
    const { sponsor, headers } = await booth("STAND");
    await scan(sponsor.id, headers, CODE("late"));

    await attendee(CODE("late"), { firstName: "Tardive" });
    const row = (await list(sponsor.id, headers)).json().scans[0];

    expect(row.attendee.firstName).toBe("Tardive");
  });
});

describe("Sponsor badge scans — export (#813)", () => {
  it("should export first name, last name, email and company, Excel-ready", async () => {
    const { sponsor, headers } = await booth("STAND");
    await scan(sponsor.id, headers, CODE("live"));
    await scan(sponsor.id, headers, "inconnu-123");

    const res = await exportCsv(sponsor.id, headers);
    const lines = res.body.replace(/^﻿/, "").trim().split("\r\n");

    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Prénom;Nom;E-mail;Entreprise;Scanné le;Scanné par;Code non reconnu");
    expect(lines).toHaveLength(3);
    expect(lines.find((l) => l.startsWith("Hélène"))).toMatch(/^Hélène;Martin;helene@example\.org;Cassoulet SA;/);
    expect(lines.find((l) => l.endsWith(";inconnu-123"))).toMatch(/^;;;;/);
  });

  it("should neutralise a name Excel would run as a formula", async () => {
    const { sponsor, headers } = await booth("STAND");
    await attendee(CODE("formula"), { firstName: "=HYPERLINK(\"x\")" });
    await scan(sponsor.id, headers, CODE("formula"));

    const res = await exportCsv(sponsor.id, headers);

    expect(res.body).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
