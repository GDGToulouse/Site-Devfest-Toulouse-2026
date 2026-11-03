process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// The link is emailed; stub SMTP and read the token from the mail itself.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import Fastify, { type FastifyInstance } from "fastify";

import adminSpeakerRoutes from "../routes/admin/speakers.js";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { generateEditToken, generateInvitationToken, hashLinkToken } from "../lib/edit-token.js";
import { findPendingInvitation } from "../lib/sponsor-invitation.js";

// #672 — the speaker edit link and the sponsor invitation are bearer secrets.
// The database keeps only their SHA-256: a leaked dump or backup no longer
// hands out working links, and the links already mailed keep working because
// the migration hashed them in place.

const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let admin: FastifyInstance;
const speakerIds: number[] = [];
const sponsorIds: number[] = [];

async function createSpeaker(data: Record<string, unknown> = {}) {
  const speaker = await prisma.speaker.create({
    data: { name: "Hash Link", slug: `hash-link-${speakerIds.length}-${tag}`, contactEmail: "hash@example.org", ...data },
  });
  speakerIds.push(speaker.id);
  return speaker;
}

function mailedToken(pattern: RegExp): string {
  const mail = sendMailMock.mock.calls[0][0] as { text: string };
  const match = mail.text.match(pattern);
  if (!match) throw new Error(`no link in the mail: ${mail.text}`);
  return match[1];
}

beforeAll(async () => {
  admin = Fastify({ logger: false });
  await admin.register(adminSpeakerRoutes, { prefix: "/api/admin" });
  await admin.ready();
});

beforeEach(() => {
  sendMailMock.mockClear();
});

afterAll(async () => {
  await admin.close();
  if (speakerIds.length) await prisma.speaker.deleteMany({ where: { id: { in: speakerIds } } });
  if (sponsorIds.length) await prisma.sponsor.deleteMany({ where: { id: { in: sponsorIds } } });
});

describe("Speaker edit link (#672)", () => {
  it("should store the hash of the mailed token, never the token", async () => {
    const speaker = await createSpeaker();

    const res = await admin.inject({ method: "POST", url: `/api/admin/speakers/${speaker.id}/edit-link`, payload: {} });

    expect(res.statusCode).toBe(200);
    const token = mailedToken(/\/edit\/([0-9a-f]{64})/);
    const stored = await prisma.speaker.findUniqueOrThrow({ where: { id: speaker.id } });
    expect(stored.editToken).toBe(hashLinkToken(token));
    expect(stored.editToken).not.toBe(token);
  });

  it("should open the link by its token, and not by the stored hash", async () => {
    const token = generateEditToken();
    await createSpeaker({ editToken: hashLinkToken(token), editTokenSentAt: new Date() });
    const app = await buildEditApp();

    const byToken = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    const byHash = await app.inject({ method: "GET", url: `/api/edit/${hashLinkToken(token)}` });
    await app.close();

    expect(byToken.statusCode).toBe(200);
    // A leaked hash must not be a working link in its own right.
    expect(byHash.statusCode).toBe(404);
  });
});

describe("Sponsor invitation (#672)", () => {
  it("should find a pending invitation by its token, and not by the stored hash", async () => {
    const sponsor = await prisma.sponsor.create({ data: { name: "Hash Invite", slug: `hash-invite-${tag}` } });
    sponsorIds.push(sponsor.id);
    const token = generateInvitationToken();
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "invite@example.org", invitationToken: hashLinkToken(token), invitationSentAt: new Date() },
    });

    expect((await findPendingInvitation(token))?.sponsorId).toBe(sponsor.id);
    expect(await findPendingInvitation(hashLinkToken(token))).toBeNull();
  });
});

describe("Migration of the links already sent (#672)", () => {
  const sql = readFileSync(
    new URL("../../prisma/migrations/20261028110300_hash_link_tokens/migration.sql", import.meta.url),
    "utf8",
  );
  const EXPRESSION = `encode(sha256(convert_to($1, 'UTF8')), 'hex')`;

  it("should hash with the same function as the application", async () => {
    // The migration rewrites both columns with this expression; a link mailed
    // before it must still resolve afterwards, so Postgres and Node must agree.
    const token = generateEditToken();
    const rows = await prisma.$queryRawUnsafe<{ h: string }[]>(`SELECT ${EXPRESSION} AS h`, token);

    expect(rows[0].h).toBe(hashLinkToken(token));
    expect(sql).toContain(`encode(sha256(convert_to("editToken", 'UTF8')), 'hex')`);
    expect(sql).toContain(`encode(sha256(convert_to("invitationToken", 'UTF8')), 'hex')`);
  });
});
