import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { notDeleted } from "../../lib/admin-helpers.js";
import { feedbackPhase, feedbackWindow } from "../../lib/talk-feedback.js";
import { resultsForTalks } from "../../lib/talk-feedback-results.js";
import { canEnableTestMode, countTestVotes, disableTestMode } from "../../lib/talk-feedback-test-mode.js";

// The audience feedback of an edition, back-office side (#563): its test mode
// (#566) and its results (#565). ADMIN only: the switch-off deletes data, and
// the private messages were written for the speaker and the organisers.

const ID_PARAMS = { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 1 } } } as const;

async function findEdition(id: number) {
  return prisma.edition.findFirst({
    where: { id, ...notDeleted },
    select: { id: true, startDate: true, endDate: true, feedbackTestMode: true },
  });
}

export default async function adminFeedbackRoutes(app: FastifyInstance) {
  // GET /api/admin/editions/:id/feedback-test-mode — where the test mode stands,
  // and how many test votes a switch-off would delete.
  app.get<{ Params: { id: number } }>("/editions/:id/feedback-test-mode", {
    schema: { params: ID_PARAMS },
  }, async (request, reply) => {
    const edition = await findEdition(request.params.id);
    if (!edition) return reply.code(404).send({ error: "Edition not found" });
    return {
      enabled: edition.feedbackTestMode,
      canEnable: canEnableTestMode(edition),
      opensAt: feedbackWindow(edition)?.opensAt ?? null,
      testVotes: await countTestVotes(edition.id),
    };
  });

  // PUT /api/admin/editions/:id/feedback-test-mode — on, or off and wipe.
  app.put<{ Params: { id: number }; Body: { enabled: boolean } }>("/editions/:id/feedback-test-mode", {
    schema: {
      params: ID_PARAMS,
      body: { type: "object", required: ["enabled"], additionalProperties: false, properties: { enabled: { type: "boolean" } } },
    },
  }, async (request, reply) => {
    const edition = await findEdition(request.params.id);
    if (!edition) return reply.code(404).send({ error: "Edition not found" });

    if (!request.body.enabled) {
      const deleted = await disableTestMode(edition.id);
      return { enabled: false, deleted };
    }

    // Refused by the API, not only hidden by the screen: from the event day
    // on, votes are real and a test mode must not be able to touch them.
    if (!canEnableTestMode(edition)) {
      return reply.code(409).send({
        error: "test_mode_too_late",
        message: edition.startDate
          ? "Le mode test ne peut s'activer qu'avant le jour de l'événement."
          : "Renseignez d'abord la date de l'édition.",
      });
    }
    await prisma.edition.update({ where: { id: edition.id }, data: { feedbackTestMode: true } });
    return { enabled: true, deleted: 0 };
  });

  // GET /api/admin/editions/:id/feedback — every published session with its
  // vote count and the spread of appreciations, most voted first.
  app.get<{ Params: { id: number } }>("/editions/:id/feedback", {
    schema: { params: ID_PARAMS },
  }, async (request, reply) => {
    const edition = await findEdition(request.params.id);
    if (!edition) return reply.code(404).send({ error: "Edition not found" });

    const talks = await prisma.talk.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
      select: { id: true, title: true, slug: true, speakers: { select: { name: true }, where: notDeleted } },
    });
    const results = await resultsForTalks(talks.map((t) => t.id));
    return {
      phase: feedbackPhase(edition),
      talks: talks
        .map((talk) => {
          const r = results.get(talk.id)!;
          return {
            id: talk.id,
            title: talk.title,
            slug: talk.slug,
            speakers: talk.speakers.map((s) => s.name),
            votes: r.votes,
            testVotes: r.testVotes,
            items: r.items,
            messages: r.messages.length,
          };
        })
        .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title, "fr")),
    };
  });

  // GET /api/admin/talks/:id/feedback — one session in detail, its messages
  // included, the hidden ones flagged rather than dropped.
  app.get<{ Params: { id: number } }>("/talks/:id/feedback", {
    schema: { params: ID_PARAMS },
  }, async (request, reply) => {
    const talk = await prisma.talk.findFirst({
      where: { id: request.params.id, ...notDeleted },
      select: { id: true, title: true },
    });
    if (!talk) return reply.code(404).send({ error: "Talk not found" });
    const results = (await resultsForTalks([talk.id])).get(talk.id)!;
    return { id: talk.id, title: talk.title, ...results };
  });

  // PUT /api/admin/feedback/:id/message — hide a message out of place, or
  // show it again. Hidden, it leaves the speaker's page and the recap (#567).
  app.put<{ Params: { id: number }; Body: { hidden: boolean } }>("/feedback/:id/message", {
    schema: {
      params: ID_PARAMS,
      body: { type: "object", required: ["hidden"], additionalProperties: false, properties: { hidden: { type: "boolean" } } },
    },
  }, async (request, reply) => {
    const { count } = await prisma.talkFeedback.updateMany({
      where: { id: request.params.id, message: { not: null } },
      data: { messageHidden: request.body.hidden },
    });
    if (count === 0) return reply.code(404).send({ error: "Message not found" });
    return { id: request.params.id, hidden: request.body.hidden };
  });
}
