import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";
import { hasPendingInvitation } from "../lib/sponsor-invitation.js";

// #362 — sponsors no longer edit through a link anyone holding the URL can use.
// The links already sent cannot simply die: opening one mints the invitation
// that replaces it and burns the token.

let editionId: number;
const created = { sponsorIds: [] as number[], userIds: [] as string[] };

async function createSponsorWithLink(
  name: string,
  contact: { email: string; token: string; locked?: boolean; sentAt?: Date; userId?: string },
) {
  const suffix = `${Date.now()}-${Math.round(performance.now())}`;
  const sponsor = await createSponsorFixture({
    name: `${name} ${suffix}`,
    slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${suffix}`,
    editionId,
    tierId: await tierIdByKey("gold"),
  });
  created.sponsorIds.push(sponsor.id);

  await prisma.sponsorContact.create({
    data: {
      sponsorId: sponsor.id,
      email: contact.email,
      editToken: contact.token,
      editTokenSentAt: contact.sentAt ?? new Date(),
      editLinkLocked: contact.locked ?? false,
      ...(contact.userId ? { userId: contact.userId } : {}),
    },
  });
  return sponsor;
}

beforeAll(async () => {
  const edition = await getSeededEdition();
  editionId = edition.id;
});

afterAll(async () => {
  if (created.sponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  }
  if (created.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
});

describe("Sponsor edit link becomes an invitation (#362)", () => {
  it("converts the link on first use and points at the invitation", async () => {
    const token = `convert-${Date.now()}-a`;
    const sponsor = await createSponsorWithLink("Convert Co", { email: "boss@example.org", token });

    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe("sponsor-invitation");
    expect(body.invitationUrl).toMatch(/^\/sponsor\/invitation\/.+/);

    const stored = await prisma.sponsorContact.findFirstOrThrow({ where: { sponsorId: sponsor.id } });
    expect(stored.editToken).toBeNull();
    expect(stored.invitationToken).toBeTruthy();
  });

  it("consumes the link, so opening it again answers 404", async () => {
    const token = `convert-${Date.now()}-b`;
    await createSponsorWithLink("Once Co", { email: "once@example.org", token });

    const app = await buildEditApp();
    const first = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    const second = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(404);
  });

  it("opens sign-up for the invited address", async () => {
    const token = `convert-${Date.now()}-c`;
    const email = `signup-${Date.now()}@example.org`;
    await createSponsorWithLink("Signup Co", { email, token });

    const app = await buildEditApp();
    await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    // The whole point of converting: auth.ts refuses to create an account for
    // an address with no live invitation, so a conversion that did not open
    // this door would strand the sponsor on a page they cannot get past.
    expect(await hasPendingInvitation(email)).toBe(true);
  });

  it("makes the converted contact RESPONSABLE when the sponsor has none", async () => {
    const token = `convert-${Date.now()}-d`;
    const sponsor = await createSponsorWithLink("Lead Co", { email: "lead@example.org", token });

    const app = await buildEditApp();
    await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    const stored = await prisma.sponsorContact.findFirstOrThrow({ where: { sponsorId: sponsor.id } });
    expect(stored.accessRole).toBe("RESPONSABLE");
  });

  it("keeps the existing role when the sponsor already has a RESPONSABLE", async () => {
    const token = `convert-${Date.now()}-e`;
    const sponsor = await createSponsorWithLink("Second Co", { email: "second@example.org", token });
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "chief@example.org", accessRole: "RESPONSABLE" },
    });

    const app = await buildEditApp();
    await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    const stored = await prisma.sponsorContact.findFirstOrThrow({
      where: { sponsorId: sponsor.id, email: "second@example.org" },
    });
    expect(stored.accessRole).toBe("EDITEUR");
  });

  it("converts a link past its 30-day window", async () => {
    const token = `convert-${Date.now()}-f`;
    // Expiry is not a reason to strand someone: the link still proves we wrote
    // to them, and the invitation it mints carries its own 7-day deadline.
    await createSponsorWithLink("Stale Co", {
      email: "stale@example.org",
      token,
      sentAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });

    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json().kind).toBe("sponsor-invitation");
  });

  it("refuses to convert a link an organiser revoked", async () => {
    const token = `convert-${Date.now()}-g`;
    const sponsor = await createSponsorWithLink("Locked Co", {
      email: "locked@example.org",
      token,
      locked: true,
    });

    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    // Locking is the only lever organisers have over a link already sent
    // (RG-245); letting it open an account would take that back.
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("locked");
    const stored = await prisma.sponsorContact.findFirstOrThrow({ where: { sponsorId: sponsor.id } });
    expect(stored.editToken).toBe(token);
  });

  it("answers 409 without consuming the link when an account already exists", async () => {
    const token = `convert-${Date.now()}-h`;
    const user = await prisma.user.create({
      data: { email: `bound-${Date.now()}@example.org`, role: "SPONSOR" },
    });
    created.userIds.push(user.id);
    const sponsor = await createSponsorWithLink("Bound Co", {
      email: user.email,
      token,
      userId: user.id,
    });

    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("already_has_account");
    // Not consumed: closing the tab and coming back must still explain this.
    const stored = await prisma.sponsorContact.findFirstOrThrow({ where: { sponsorId: sponsor.id } });
    expect(stored.editToken).toBe(token);
  });

  it("answers 404 for a link whose company sits in the trash", async () => {
    const token = `convert-${Date.now()}-i`;
    const sponsor = await createSponsorWithLink("Trashed Co", { email: "trashed@example.org", token });
    await prisma.sponsor.update({ where: { id: sponsor.id }, data: { deletedAt: new Date() } });

    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    expect(res.statusCode).toBe(404);
  });

  it("no longer serves a sponsor profile through the link", async () => {
    const token = `convert-${Date.now()}-j`;
    await createSponsorWithLink("No Profile Co", { email: "profile@example.org", token });

    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${token}` });
    await app.close();

    // The reply carries an invitation, never the editable fields it used to.
    expect(res.json().fields).toBeUndefined();
    expect(res.json().private).toBeUndefined();
  });

  it("refuses a write through a sponsor link", async () => {
    const token = `convert-${Date.now()}-k`;
    await createSponsorWithLink("No Write Co", { email: "write@example.org", token });

    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${token}`,
      payload: { descriptionFr: "Rewritten" },
    });
    await app.close();

    expect(res.statusCode).toBe(400);
  });
});
