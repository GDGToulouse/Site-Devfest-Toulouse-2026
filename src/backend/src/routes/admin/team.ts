import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound, softDeleteData } from "../../lib/admin-helpers.js";
import { revalidateAll } from "../../lib/revalidate.js";
import { byLastName, teamMemberBodyError, teamMemberBodySchema, teamMemberData, type TeamMemberBody } from "../../lib/team.js";

// The organisers' team in the back-office (#110), ADMIN and EDITOR like the
// rest of the content. Every write purges the whole site: the "Équipe" menu
// entry, in the header of every page, appears once a member is ticked for the
// featured edition, and a team changes a handful of times a year.

const idParams = { type: "object", required: ["id"], properties: { id: { type: "string", pattern: "^[0-9]+$" } } } as const;

const memberInclude = {
  editions: { where: { edition: notDeleted }, select: { edition: { select: { id: true, year: true } } } },
} as const;

type MemberRow = Awaited<ReturnType<typeof prisma.teamMember.findFirstOrThrow<{ include: typeof memberInclude }>>>;

function serialize({ editions, ...member }: MemberRow) {
  return {
    ...member,
    editions: editions.map((e) => e.edition).sort((a, b) => b.year - a.year),
  };
}

export default async function adminTeamRoutes(app: FastifyInstance) {
  // GET /api/admin/team — every member, alphabetical, with the years they organised.
  app.get("/team", async () => {
    const members = await prisma.teamMember.findMany({ where: notDeleted, include: memberInclude });
    return members.sort(byLastName).map(serialize);
  });

  // GET /api/admin/team/:id
  app.get<{ Params: { id: string } }>("/team/:id", { schema: { params: idParams } }, async (request, reply) => {
    const member = await prisma.teamMember.findFirst({
      where: { id: Number(request.params.id), ...notDeleted },
      include: memberInclude,
    });
    if (!member) return notFound(reply, "Team member");
    return serialize(member);
  });

  // POST /api/admin/team
  app.post<{ Body: TeamMemberBody }>("/team", { schema: { body: teamMemberBodySchema } }, async (request, reply) => {
    const invalid = teamMemberBodyError(request.body);
    if (invalid) return reply.code(400).send({ error: "invalid_field", field: invalid });

    const member = await prisma.teamMember.create({
      data: {
        ...teamMemberData(request.body),
        editions: { create: (request.body.editionIds ?? []).map((editionId) => ({ editionId })) },
      },
      include: memberInclude,
    });
    await revalidateAll();
    return reply.code(201).send(serialize(member));
  });

  // PUT /api/admin/team/:id — the whole member, editions included: the ticked
  // years replace the previous ones.
  app.put<{ Params: { id: string }; Body: TeamMemberBody }>("/team/:id", {
    schema: { params: idParams, body: teamMemberBodySchema },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const existing = await prisma.teamMember.findFirst({ where: { id, ...notDeleted }, select: { id: true } });
    if (!existing) return notFound(reply, "Team member");

    const invalid = teamMemberBodyError(request.body);
    if (invalid) return reply.code(400).send({ error: "invalid_field", field: invalid });

    const editionIds = request.body.editionIds;
    const member = await prisma.teamMember.update({
      where: { id },
      data: {
        ...teamMemberData(request.body),
        ...(editionIds && {
          editions: { deleteMany: {}, create: editionIds.map((editionId) => ({ editionId })) },
        }),
      },
      include: memberInclude,
    });
    await revalidateAll();
    return serialize(member);
  });

  // DELETE /api/admin/team/:id — to the trash, restorable for 30 days.
  app.delete<{ Params: { id: string } }>("/team/:id", { schema: { params: idParams } }, async (request, reply) => {
    const id = Number(request.params.id);
    const existing = await prisma.teamMember.findFirst({ where: { id, ...notDeleted }, select: { id: true } });
    if (!existing) return notFound(reply, "Team member");

    await prisma.teamMember.update({ where: { id }, data: softDeleteData() });
    await revalidateAll();
    return reply.code(204).send();
  });
}
