import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { notDeleted } from "../lib/admin-helpers.js";
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  TALK_FEEDBACK_CODES,
  feedbackPhase,
  publicTrend,
} from "../lib/talk-feedback.js";
import { getFeaturedEdition } from "./editions.js";

// The audience's opinion of a session (#563, #564). Public and anonymous: the
// browser keeps a random voterId, and the database's (talk, voter) unique key
// is the whole of the "one vote per browser" rule. Under /talks so the
// frontend's existing /api/talks rewrite carries it.

const VOTER_ID = { type: "string", pattern: "^[0-9a-fA-F-]{36}$" } as const;
const SLUG_PARAMS = { type: "object", required: ["slug"], properties: { slug: { type: "string" } } } as const;

// Generous for one person, a ceiling for a script: a room of 500 behind one
// venue Wi-Fi address votes on one or two sessions each, not on hundreds.
const FEEDBACK_RATE_LIMIT = { max: 60, timeWindow: "1 minute" };

interface VoteBody {
  voterId: string;
  items: string[];
}

interface MessageBody {
  voterId: string;
  message: string;
}

/** A published session of the featured edition, with the edition's dates. */
async function findTalk(slug: string) {
  const edition = await getFeaturedEdition();
  if (!edition) return null;
  const talk = await prisma.talk.findFirst({
    where: { editionId: edition.id, slug, publicationStatus: "PUBLISHED", ...notDeleted },
    select: { id: true },
  });
  return talk ? { talkId: talk.id, edition } : null;
}

export default async function talkFeedbackRoutes(app: FastifyInstance) {
  // GET /api/talks/:slug/feedback?voterId= — where voting stands for this
  // browser, and the public trend once it may be shown: after one has voted
  // (so it does not steer the vote) or once voting is over.
  app.get<{ Params: { slug: string }; Querystring: { voterId?: string } }>("/talks/:slug/feedback", {
    schema: {
      params: SLUG_PARAMS,
      querystring: { type: "object", properties: { voterId: VOTER_ID } },
    },
  }, async (request, reply) => {
    const found = await findTalk(request.params.slug);
    if (!found) return reply.code(404).send({ error: "Talk not found" });

    const phase = feedbackPhase(found.edition);
    if (phase === "upcoming") return { phase, hasVoted: false, hasMessage: false, trend: null };

    const { voterId } = request.query;
    const mine = voterId
      ? await prisma.talkFeedback.findUnique({
          where: { talkId_voterId: { talkId: found.talkId, voterId } },
          select: { message: true },
        })
      : null;
    const hasVoted = mine !== null;
    const mayShowTrend = hasVoted || phase === "closed";
    const votes = mayShowTrend
      ? await prisma.talkFeedback.findMany({ where: { talkId: found.talkId }, select: { items: true } })
      : [];

    return {
      phase,
      hasVoted,
      hasMessage: Boolean(mine?.message),
      trend: mayShowTrend ? publicTrend(votes) : null,
    };
  });

  // POST /api/talks/:slug/feedback — cast this browser's vote, once.
  app.post<{ Params: { slug: string }; Body: VoteBody }>("/talks/:slug/feedback", {
    config: { rateLimit: FEEDBACK_RATE_LIMIT },
    schema: {
      params: SLUG_PARAMS,
      body: {
        type: "object",
        required: ["voterId", "items"],
        additionalProperties: false,
        properties: {
          voterId: VOTER_ID,
          items: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: { type: "string", enum: TALK_FEEDBACK_CODES },
          },
        },
      },
    },
  }, async (request, reply) => {
    const found = await findTalk(request.params.slug);
    if (!found) return reply.code(404).send({ error: "Talk not found" });
    if (feedbackPhase(found.edition) !== "open") {
      return reply.code(403).send({ error: "feedback_closed", message: "Les avis ne sont pas ouverts pour cette session." });
    }

    const { voterId, items } = request.body;
    try {
      await prisma.talkFeedback.create({ data: { talkId: found.talkId, voterId, items } });
    } catch (err) {
      // The unique (talk, voter) key: a second vote from this browser, or two
      // clicks racing each other.
      if ((err as { code?: string }).code === "P2002") {
        return reply.code(409).send({ error: "already_voted", message: "Vous avez déjà donné votre avis sur cette session." });
      }
      throw err;
    }
    return reply.code(201).send({ success: true });
  });

  // POST /api/talks/:slug/feedback/message — the private message to the
  // speaker, once, after this browser has voted. Never readable publicly.
  app.post<{ Params: { slug: string }; Body: MessageBody }>("/talks/:slug/feedback/message", {
    config: { rateLimit: FEEDBACK_RATE_LIMIT },
    schema: {
      params: SLUG_PARAMS,
      body: {
        type: "object",
        required: ["voterId", "message"],
        additionalProperties: false,
        properties: {
          voterId: VOTER_ID,
          message: { type: "string", minLength: 1, maxLength: FEEDBACK_MESSAGE_MAX_LENGTH },
        },
      },
    },
  }, async (request, reply) => {
    const found = await findTalk(request.params.slug);
    if (!found) return reply.code(404).send({ error: "Talk not found" });
    if (feedbackPhase(found.edition) !== "open") {
      return reply.code(403).send({ error: "feedback_closed", message: "Les avis ne sont pas ouverts pour cette session." });
    }

    const message = request.body.message.trim();
    if (!message) return reply.code(400).send({ error: "empty_message", message: "Le message est vide." });

    // Only a message not yet written is filled in: the condition sits in the
    // update itself, so two submissions cannot both land.
    const { count } = await prisma.talkFeedback.updateMany({
      where: { talkId: found.talkId, voterId: request.body.voterId, message: null },
      data: { message, messageAt: new Date() },
    });
    if (count === 0) {
      const vote = await prisma.talkFeedback.findUnique({
        where: { talkId_voterId: { talkId: found.talkId, voterId: request.body.voterId } },
        select: { id: true },
      });
      return vote
        ? reply.code(409).send({ error: "message_already_sent", message: "Vous avez déjà laissé un message pour cette session." })
        : reply.code(404).send({ error: "no_vote", message: "Donnez d'abord votre avis sur la session." });
    }
    return reply.code(201).send({ success: true });
  });
}
