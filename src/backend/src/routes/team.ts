import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { byLastName } from "../lib/team.js";
import { getFeaturedEdition } from "./editions.js";

export default async function teamRoutes(app: FastifyInstance) {
  // GET /api/team — the organisers of the featured edition (#110), or of
  // `?year=`, in alphabetical order of last name (RG-412). An empty list when
  // no one is ticked yet: the page then says the team will be presented soon.
  app.get<{ Querystring: { year?: string } }>("/team", {
    schema: { querystring: { type: "object", properties: { year: { type: "string", pattern: "^[0-9]{4}$" } } } },
  }, async (request) => {
    const edition = request.query.year
      ? await prisma.edition.findFirst({ where: { year: Number(request.query.year), ...notDeleted } })
      : await getFeaturedEdition();
    if (!edition) return { year: null, members: [] };

    const members = await prisma.teamMember.findMany({
      where: { ...notDeleted, editions: { some: { editionId: edition.id } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        websiteUrl: true,
        linkedinUrl: true,
        twitterUrl: true,
        githubUrl: true,
        blueskyUrl: true,
      },
    });
    return { year: edition.year, members: members.sort(byLastName) };
  });
}
