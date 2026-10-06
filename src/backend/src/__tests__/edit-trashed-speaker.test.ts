import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #523 — a speaker or a session sent to the trash is gone for the site; the
// modification link must not keep reading or editing it. Restoring the speaker
// brings the link back, since the token itself is never touched.

const TOKEN = "test-edit-trashed-speaker-token-0123456789abcdef";
let speakerId: number;
let liveTalkId: number;
let trashedTalkId: number;

async function trashSpeaker(deletedAt: Date | null) {
  await prisma.speaker.update({ where: { id: speakerId }, data: { deletedAt } });
}

describe("Modification link of trashed content (#523)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    const speaker = await prisma.speaker.create({
      data: {
        name: "Trashed Link Speaker",
        slug: "trashed-link-speaker",
        editToken: TOKEN,
        editTokenSentAt: new Date(),
        editLinkLocked: false,
      },
    });
    speakerId = speaker.id;

    const talk = (slug: string, deletedAt: Date | null) =>
      prisma.talk.create({
        data: {
          editionId: edition.id, slug, title: slug, description: "", format: "CONFERENCE",
          language: "fr", publicationStatus: "PUBLISHED", isSpeakerEditable: true, deletedAt,
          speakers: { connect: { id: speakerId } },
        },
      });
    liveTalkId = (await talk("trashed-link-live-talk", null)).id;
    trashedTalkId = (await talk("trashed-link-trashed-talk", new Date())).id;
  });

  afterAll(async () => {
    await prisma.talk.deleteMany({ where: { id: { in: [liveTalkId, trashedTalkId] } } });
    await prisma.speaker.deleteMany({ where: { id: speakerId } });
  });

  it("should neither list nor edit a trashed session", async () => {
    const app = await buildEditApp();
    const get = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}` });
    const put = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}/talks/${trashedTalkId}`,
      payload: { title: "Réécrit depuis la corbeille" },
    });
    await app.close();

    expect(get.statusCode).toBe(200);
    expect(get.json().talks.map((t: { id: number }) => t.id)).toEqual([liveTalkId]);
    expect(put.statusCode).toBe(404);
  });

  it("should answer 404 on read and write once the speaker is trashed", async () => {
    await trashSpeaker(new Date());
    const app = await buildEditApp();
    try {
      const get = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}` });
      const put = await app.inject({ method: "PUT", url: `/api/edit/${TOKEN}`, payload: { company: "Corbeille" } });
      const putTalk = await app.inject({
        method: "PUT",
        url: `/api/edit/${TOKEN}/talks/${liveTalkId}`,
        payload: { title: "Réécrit" },
      });

      expect(get.statusCode).toBe(404);
      expect(put.statusCode).toBe(404);
      expect(putTalk.statusCode).toBe(404);
      const stored = await prisma.speaker.findUnique({ where: { id: speakerId } });
      expect(stored?.company).not.toBe("Corbeille");
    } finally {
      await app.close();
      await trashSpeaker(null);
    }
  });

  it("should work again once the speaker is restored", async () => {
    await trashSpeaker(new Date());
    await trashSpeaker(null);
    const app = await buildEditApp();
    const get = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}` });
    await app.close();

    expect(get.statusCode).toBe(200);
  });
});
