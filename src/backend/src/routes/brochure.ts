import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../lib/brochure-token.js";
import { getFeaturedEdition } from "./editions.js";

// GET /api/brochure/:token — public redirector that:
//   1. validates the HMAC-signed token (id is bound to a server secret),
//   2. atomically increments the brochure download counter on the matching
//      ContactMessage,
//   3. issues a 302 to the current edition's sponsorBrochureUrl.
//
// We intentionally use a 302 (not 301) — the brochure URL can change between
// sponsor cycles, and we don't want intermediaries to cache the redirect.
//
// The endpoint is unauthenticated. The HMAC binding is what gates access:
// without the secret, an attacker can't mint a token for an arbitrary id.
export default async function brochureRoutes(app: FastifyInstance) {
  app.get<{ Params: { token: string } }>("/brochure/:token", async (request, reply) => {
    const id = verifyToken(request.params.token);
    if (id === null) {
      return reply.status(404).send({ error: "Not found" });
    }

    const featured = await getFeaturedEdition();

    if (!featured?.sponsorBrochureUrl) {
      // Nothing to redirect to — treat as gone.
      return reply.status(404).send({ error: "Brochure unavailable" });
    }

    // Best-effort: a missing/already-deleted message just skips the bookkeeping
    // but still serves the file (the email was legitimate when it was sent).
    try {
      await prisma.contactMessage.update({
        where: { id },
        data: {
          brochureDownloadCount: { increment: 1 },
          brochureDownloadedAt: new Date(),
        },
      });
    } catch (err) {
      request.log.warn({ err, id }, "[brochure] could not update download counter");
    }

    return reply.redirect(featured.sponsorBrochureUrl, 302);
  });
}
