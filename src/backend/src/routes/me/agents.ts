import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../lib/auth-context.js";
import { listConnectedAgents, revokeAgents } from "../../lib/agent-grants.js";

// A person's own AI agents (#514): see them, withdraw them. Every account may —
// the team and the sponsors alike — unlike the API key routes next door, which
// are back-office only. Signed in from the browser only: an agent does not get
// to list or revoke agents.

async function requireBrowserSession(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await getAuthContext(request);
  if (!ctx || ctx.source !== "session") {
    reply.code(401).send({ error: "Unauthenticated" });
    return;
  }
  request.authContext = ctx;
}

const agentSchema = {
  type: "object",
  properties: {
    clientId: { type: "string" },
    name: { type: ["string", "null"] },
    uri: { type: ["string", "null"] },
    connectedAt: { type: ["string", "null"], format: "date-time" },
    lastTokenAt: { type: ["string", "null"], format: "date-time" },
  },
} as const;

export default async function myAgentsRoutes(app: FastifyInstance) {
  app.get("/agents", {
    preHandler: requireBrowserSession,
    schema: {
      tags: ["me"],
      summary: "Agents IA connectés à mon compte",
      response: { 200: { type: "array", items: agentSchema }, 401: { $ref: "Error#" } },
    },
  }, async (request) => listConnectedAgents(request.authContext!.user.id));

  app.delete<{ Params: { clientId: string } }>("/agents/:clientId", {
    preHandler: requireBrowserSession,
    schema: {
      tags: ["me"],
      summary: "Retirer l'accès d'un agent IA",
      params: { type: "object", required: ["clientId"], properties: { clientId: { type: "string", maxLength: 2048 } } },
      response: { 401: { $ref: "Error#" }, 404: { $ref: "Error#" } },
    },
  }, async (request, reply) => {
    const revoked = await revokeAgents(request.authContext!.user.id, request.params.clientId);
    if (revoked === 0) return reply.code(404).send({ error: "Agent not found" });
    return reply.code(204).send();
  });
}
