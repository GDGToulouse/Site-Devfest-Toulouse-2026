process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminRoutes from "../routes/admin/index.js";
import speakerRoutes from "../routes/speakers.js";
import sponsorRoutes from "../routes/sponsors.js";
import editionRoutes from "../routes/editions.js";
import { registerAuthRoutes } from "../plugins/auth-routes.js";
import { registerRequestContext } from "../lib/request-context.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { prisma } from "../lib/prisma.js";
import { createAgentClient, createUserWithPassword, obtainAgentToken, signInCookie } from "./agent-test-helpers.js";

// #618 — the team previews a draft speaker, talk or sponsor on the site. The
// preview reads lift the publication filters, so who may call them is the whole
// point: a team member in the browser, never a visitor, a sponsor account, an
// API key or an AI agent — and the public routes keep answering 404.

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// A past year of its own, so the featured edition and its menu never move.
const TEST_YEAR = 1530;

let app: FastifyInstance;
let clientId: string;
let editionId: number;
let tierId: number;
let editorCookie: string;
const ids = { userIds: [] as string[], speakerIds: [] as number[], sponsorIds: [] as number[] };
const SPEAKER = `preview-speaker-${stamp}`;
const TRASHED_SPEAKER = `preview-trashed-${stamp}`;
const SPONSOR = `preview-sponsor-${stamp}`;
const TALK = `preview-talk-${stamp}`;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("adminUser");
  registerRequestContext(app);
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await registerAuthRoutes(app);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(speakerRoutes, { prefix: "/api" });
  await app.register(sponsorRoutes, { prefix: "/api" });
  await app.register(editionRoutes, { prefix: "/api" });
  await app.ready();
  clientId = await createAgentClient("Claude (aperçu)");

  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR } })).id;
  tierId = (await prisma.sponsorTier.create({ data: { key: `preview-${stamp}`, nameFr: "Aperçu", nameEn: "Preview" } })).id;

  const speaker = await prisma.speaker.create({
    data: { slug: SPEAKER, name: "Ada Brouillon", editions: { create: { editionId, publicationStatus: "DRAFT" } } },
  });
  const trashed = await prisma.speaker.create({
    data: {
      slug: TRASHED_SPEAKER,
      name: "Ada Corbeille",
      deletedAt: new Date(),
      editions: { create: { editionId, publicationStatus: "DRAFT" } },
    },
  });
  ids.speakerIds.push(speaker.id, trashed.id);
  await prisma.talk.create({
    data: {
      slug: TALK,
      title: "Un brouillon",
      description: "",
      format: "CONFERENCE",
      language: "fr",
      editionId,
      publicationStatus: "DRAFT",
      speakers: { connect: { id: speaker.id } },
    },
  });
  const sponsor = await prisma.sponsor.create({
    data: { slug: SPONSOR, name: "Brouillon SA", editions: { create: { editionId, tierId, publicationStatus: "DRAFT" } } },
  });
  ids.sponsorIds.push(sponsor.id);

  const editor = await createUserWithPassword("EDITOR", "Éditrice aperçu");
  ids.userIds.push(editor.id);
  editorCookie = await signInCookie(app, editor.email);
});

afterAll(async () => {
  await app.close();
  if (editionId !== undefined) await prisma.talk.deleteMany({ where: { editionId } });
  await prisma.speaker.deleteMany({ where: { id: { in: ids.speakerIds } } });
  await prisma.sponsor.deleteMany({ where: { id: { in: ids.sponsorIds } } });
  await prisma.edition.delete({ where: { id: editionId } });
  await prisma.sponsorTier.delete({ where: { id: tierId } });
  await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  await prisma.oauthClient.delete({ where: { clientId } });
});

function preview(path: string, headers: Record<string, string> = {}) {
  return app.inject({ method: "GET", url: `/api/admin/preview${path}`, headers });
}

describe("Draft preview (#618)", () => {
  it("should show a team member the draft speaker, talk and sponsor the public routes hide", async () => {
    const [speaker, talk, sponsor] = await Promise.all([
      preview(`/speakers/${SPEAKER}`, { cookie: editorCookie }),
      preview(`/editions/${TEST_YEAR}/talks/${TALK}`, { cookie: editorCookie }),
      preview(`/sponsors/${SPONSOR}`, { cookie: editorCookie }),
    ]);
    const [publicSpeaker, publicTalk, publicSponsor] = await Promise.all([
      app.inject({ method: "GET", url: `/api/speakers/${SPEAKER}` }),
      app.inject({ method: "GET", url: `/api/editions/${TEST_YEAR}/talks/${TALK}` }),
      app.inject({ method: "GET", url: `/api/sponsors/${SPONSOR}` }),
    ]);

    expect(speaker.statusCode).toBe(200);
    expect(speaker.json().participations).toMatchObject([{ year: TEST_YEAR, talks: [{ slug: TALK }] }]);
    expect(talk.json()).toMatchObject({ title: "Un brouillon", speakers: [{ slug: SPEAKER }] });
    expect(sponsor.json()).toMatchObject({ name: "Brouillon SA", editions: [TEST_YEAR] });
    expect([publicSpeaker.statusCode, publicTalk.statusCode, publicSponsor.statusCode]).toEqual([404, 404, 404]);
  });

  it("should keep the trash out of the preview", async () => {
    const res = await preview(`/speakers/${TRASHED_SPEAKER}`, { cookie: editorCookie });

    expect(res.statusCode).toBe(404);
  });

  it("should refuse a visitor and a sponsor account", async () => {
    const sponsorUser = await createUserWithPassword("SPONSOR", "Sponsor curieux");
    ids.userIds.push(sponsorUser.id);

    const anonymous = await preview(`/speakers/${SPEAKER}`);
    const sponsor = await preview(`/speakers/${SPEAKER}`, { cookie: await signInCookie(app, sponsorUser.email) });

    expect(anonymous.statusCode).toBe(403);
    expect(sponsor.statusCode).toBe(403);
  });

  it("should refuse a team member's API key and AI agent, which the rest of the back-office accepts", async () => {
    const editor = await createUserWithPassword("EDITOR", "Éditeur outillé");
    ids.userIds.push(editor.id);
    const key = await generateApiKey(resolveApiKeyEnv());
    await prisma.apiKey.create({ data: { name: "preview", prefix: key.prefix, hashedKey: key.hashedKey, userId: editor.id } });
    const agentToken = await obtainAgentToken(app, clientId, editor.email);

    const withKey = await preview(`/speakers/${SPEAKER}`, { authorization: `Bearer ${key.raw}` });
    const withAgent = await preview(`/speakers/${SPEAKER}`, { authorization: `Bearer ${agentToken}` });
    const keyElsewhere = await app.inject({ method: "GET", url: "/api/admin/tags", headers: { authorization: `Bearer ${key.raw}` } });

    expect(withKey.statusCode).toBe(403);
    expect(withAgent.statusCode).toBe(403);
    expect(keyElsewhere.statusCode).toBe(200);
  });
});
