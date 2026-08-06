import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../lib/brochure-token.js";
import { getFeaturedEdition } from "./editions.js";

// GET /api/brochure/:token — public redirector that:
//   1. validates the HMAC-signed token (id is bound to a server secret),
//   2. atomically increments the brochure download counter on the matching
//      ContactMessage,
//   3. issues a 302 to the current edition's brochure, in the language the
//      requester used on the form (#401).
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
    const frenchUrl = featured?.sponsorBrochureUrl ?? null;
    const englishUrl = featured?.sponsorBrochureUrlEn ?? null;

    // Either brochure will do as a fallback for the other, so a single missing
    // file is not an error — only having neither is.
    const anyBrochureUrl = frenchUrl ?? englishUrl;
    if (anyBrochureUrl === null) {
      // Nothing to redirect to — treat as gone, and don't count a download
      // that never happened.
      return reply.status(404).send({ error: "Brochure unavailable" });
    }

    // Best-effort: a missing/already-deleted message just skips the bookkeeping
    // but still serves the file (the email was legitimate when it was sent).
    // The same write gives us the stored locale, so picking the language costs
    // no extra query — and the token carries only the id, never the language.
    let locale: string | null = null;
    try {
      const message = await prisma.contactMessage.update({
        where: { id },
        data: {
          brochureDownloadCount: { increment: 1 },
          brochureDownloadedAt: new Date(),
        },
        select: { locale: true },
      });
      locale = message.locale;
    } catch (err) {
      request.log.warn({ err, id }, "[brochure] could not update download counter");
    }

    // English requesters fall back to the French brochure when no English one
    // is configured: a stale-language PDF beats a dead link in an email that
    // has already been sent. The reverse fallback covers an edition that only
    // ever uploaded the English file.
    const url = locale === "en" ? (englishUrl ?? anyBrochureUrl) : anyBrochureUrl;

    return reply.redirect(url, 302);
  });
}
