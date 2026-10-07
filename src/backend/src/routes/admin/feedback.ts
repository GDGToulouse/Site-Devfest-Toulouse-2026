import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { notDeleted } from "../../lib/admin-helpers.js";
import { feedbackWindow } from "../../lib/talk-feedback.js";
import { canEnableTestMode, countTestVotes, disableTestMode } from "../../lib/talk-feedback-test-mode.js";

// The audience feedback of an edition, back-office side (#563). For now its
// test mode (#566); the results view (#565) joins it here. ADMIN only: the
// switch-off deletes data.

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
}
