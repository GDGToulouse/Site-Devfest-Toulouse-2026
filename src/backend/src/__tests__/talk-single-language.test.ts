import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import talkRoutes from "../routes/talks.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// GET /api/talks/:slug resolves against the *featured* edition, so the fixtures
// below are attached to the seeded one that the featured setting points at.
async function buildTalkApp() {
  const app = Fastify({ logger: false });
  await app.register(talkRoutes, { prefix: "/api" });
  return app;
}

// Talk is single-language (#293): title/description hold the talk's own wording,
// in the language carried by `language`. These cover the two things the merge
// migration could plausibly have broken — losing English content, and moving a
// slug that is a public, indexed URL.

let editionId: number;
let englishTalkId: number;
let frenchTalkId: number;

describe("Talk single-language content (#293)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    editionId = edition.id;

    const english = await prisma.talk.create({
      data: {
        editionId,
        // Slug derived from a French title, as it would have been before the
        // merge: an English talk keeps the URL it was indexed under.
        slug: "single-lang-conference-anglophone",
        title: "Scaling Kubernetes the hard way",
        description: "Lessons learned running clusters at scale.",
        format: "CONFERENCE",
        language: "en",
        publicationStatus: "PUBLISHED",
      },
    });
    englishTalkId = english.id;

    const french = await prisma.talk.create({
      data: {
        editionId,
        slug: "single-lang-conference-francophone",
        title: "Kubernetes à grande échelle",
        description: "Retour d'expérience sur l'exploitation de clusters.",
        format: "CONFERENCE",
        language: "fr",
        publicationStatus: "PUBLISHED",
      },
    });
    frenchTalkId = french.id;
  });

  afterAll(async () => {
    await prisma.talk.deleteMany({ where: { id: { in: [englishTalkId, frenchTalkId] } } });
  });

  it("keeps an English talk's own wording rather than a French translation", async () => {
    const talk = await prisma.talk.findUnique({ where: { id: englishTalkId } });
    expect(talk?.title).toBe("Scaling Kubernetes the hard way");
    expect(talk?.description).toBe("Lessons learned running clusters at scale.");
    expect(talk?.language).toBe("en");
    // The slug stays French-derived: it is a public URL, not a translation.
    expect(talk?.slug).toBe("single-lang-conference-anglophone");
  });

  it("serves the same wording on /fr and /en — a talk is not translated", async () => {
    const app = await buildTalkApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/talks/single-lang-conference-anglophone",
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.title).toBe("Scaling Kubernetes the hard way");
    expect(body.description).toBe("Lessons learned running clusters at scale.");
    // No bilingual pair survives on the public payload.
    expect(body).not.toHaveProperty("titleFr");
    expect(body).not.toHaveProperty("titleEn");
    expect(body).not.toHaveProperty("descriptionFr");
    expect(body).not.toHaveProperty("descriptionEn");
    await app.close();
  });

  it("keeps a French talk's wording untouched", async () => {
    const talk = await prisma.talk.findUnique({ where: { id: frenchTalkId } });
    expect(talk?.title).toBe("Kubernetes à grande échelle");
    expect(talk?.description).toBe("Retour d'expérience sur l'exploitation de clusters.");
    expect(talk?.language).toBe("fr");
  });
});
