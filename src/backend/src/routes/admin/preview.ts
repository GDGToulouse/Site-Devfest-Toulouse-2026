import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { notDeleted } from "../../lib/admin-helpers.js";
import { findSpeakerPage } from "../speakers.js";
import { findSponsorPage } from "../sponsors.js";
import { findEditionTalkPage } from "../editions.js";

// Draft preview (#618): the public page payloads, publication filters lifted.
// Same shape as the public routes, so the site renders a draft with its own
// components; the frontend calls these only in Next's draft mode, uncached.
// Guarded by requireTeamBrowserSession where they are registered.
const slugParams = {
  type: "object",
  required: ["slug"],
  properties: { slug: { type: "string", maxLength: 200 } },
} as const;

export default async function adminPreviewRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>("/preview/speakers/:slug", { schema: { params: slugParams } }, async (request, reply) => {
    const page = await findSpeakerPage(request.params.slug, { includeDrafts: true });
    if (!page) return reply.status(404).send({ error: "Speaker not found" });
    return page;
  });

  app.get<{ Params: { slug: string } }>("/preview/sponsors/:slug", { schema: { params: slugParams } }, async (request, reply) => {
    const page = await findSponsorPage(request.params.slug, { includeDrafts: true });
    if (!page) return reply.status(404).send({ error: "Sponsor not found" });
    return page;
  });

  app.get<{ Params: { year: number; slug: string } }>("/preview/editions/:year/talks/:slug", {
    schema: {
      params: {
        type: "object",
        required: ["year", "slug"],
        properties: { year: { type: "integer" }, slug: { type: "string", maxLength: 200 } },
      },
    },
  }, async (request, reply) => {
    const edition = await prisma.edition.findFirst({
      where: { year: request.params.year, ...notDeleted },
      select: { id: true, year: true },
    });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const page = await findEditionTalkPage(edition, request.params.slug, { includeDrafts: true });
    if (!page) return reply.status(404).send({ error: "Talk not found" });
    return page;
  });
}
