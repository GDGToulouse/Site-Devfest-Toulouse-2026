import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { z } from "zod";

import { getAuthContext } from "../lib/auth-context.js";
import { MCP_RESOURCE } from "../lib/auth.js";
import { isHiddenFromAgents, listCatalogRoutes } from "../lib/route-catalog.js";
import { APP_VERSION } from "../lib/version.js";

// The MCP server an AI agent talks to (#514). Two generic tools — list the
// API, call it — and no access rule of its own: call_route replays the call
// against the API with the agent's own token, so the route's usual guards
// decide, and an agent can do exactly what its person can, nothing more.
//
// Stateless: each POST gets a fresh server and transport, built around the
// token it carried. Nothing survives between calls, so nothing can leak
// between two agents.

const RESOURCE_METADATA_URL = `${new URL(MCP_RESOURCE).origin}/.well-known/oauth-protected-resource${new URL(MCP_RESOURCE).pathname}`;

// A route can answer a whole list; the agent needs to read it, not a megabyte.
const MAX_RESPONSE_CHARS = 100_000;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function bearerOf(request: FastifyRequest): string {
  const header = request.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

// RFC 9728: tell an agent without a valid token where to start authorizing.
function refuse(reply: FastifyReply) {
  return reply
    .code(401)
    .header("WWW-Authenticate", `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`)
    .send({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
}

function textResult(value: unknown, isError = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text" as const, text: text.length > MAX_RESPONSE_CHARS ? `${text.slice(0, MAX_RESPONSE_CHARS)}\n…(tronqué)` : text }],
    ...(isError && { isError: true }),
  };
}

function buildServer(app: FastifyInstance, token: string, callerIp: string) {
  const server = new McpServer({ name: "devfest-toulouse", version: APP_VERSION });

  server.registerTool(
    "list_routes",
    {
      description:
        "Liste les routes de l'API du site DevFest Toulouse (méthode, chemin, résumé, paramètres). " +
        "Toutes ne vous sont pas ouvertes : l'API applique les droits de votre compte à chaque appel.",
      inputSchema: z.object({
        search: z.string().optional().describe("Filtre sur le chemin ou le résumé, sans tenir compte de la casse"),
      }),
    },
    async ({ search }) => {
      const needle = search?.toLowerCase();
      const routes = listCatalogRoutes().filter(
        (route) => !needle || route.path.toLowerCase().includes(needle) || route.summary?.toLowerCase().includes(needle),
      );
      return textResult(routes);
    },
  );

  server.registerTool(
    "call_route",
    {
      description:
        "Appelle une route de l'API avec les droits de votre compte et renvoie son statut et sa réponse. " +
        "Une route que votre compte ne peut pas utiliser répond 401, 403 ou 404, comme dans le navigateur.",
      inputSchema: z.object({
        method: z.enum(METHODS),
        path: z.string().startsWith("/api/").describe("Chemin avec ses paramètres remplis, ex. /api/admin/speakers/12"),
        query: z.record(z.string(), z.string()).optional().describe("Paramètres de requête"),
        body: z.unknown().optional().describe("Corps JSON, pour POST, PUT et PATCH"),
      }),
    },
    async ({ method, path, query, body }) => {
      const pathname = new URL(path, "http://agent.invalid").pathname;
      if (isHiddenFromAgents(pathname)) {
        return textResult(`Route non disponible pour un agent : ${pathname}`, true);
      }
      const search = query ? `?${new URLSearchParams(query)}` : "";
      const response = await app.inject({
        method,
        url: `${pathname}${search}`,
        headers: {
          authorization: `Bearer ${token}`,
          // Keep the agent's address for the rate limit and the history, rather
          // than every agent sharing the loopback's budget.
          "x-forwarded-for": callerIp,
          ...(body !== undefined && { "content-type": "application/json" }),
        },
        ...(body !== undefined && { payload: JSON.stringify(body) }),
      });
      let parsed: unknown = response.body;
      try {
        parsed = response.body ? JSON.parse(response.body) : null;
      } catch {
        // Not JSON (a calendar, a file): hand it over as text.
      }
      return textResult({ status: response.statusCode, body: parsed }, response.statusCode >= 400);
    },
  );

  return server;
}

export default async function mcpRoutes(app: FastifyInstance) {
  app.post("/mcp", async (request, reply) => {
    // Agents only. A browser session reaching this endpoint is refused: the
    // tokens bound to /api/mcp are the one credential it was built for.
    const ctx = await getAuthContext(request);
    if (!ctx || ctx.source !== "mcp") return refuse(reply);

    const server = buildServer(app, bearerOf(request), request.ip);
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // Stateless: no server-to-client stream to open, no session to end.
  const notAllowed = (_request: FastifyRequest, reply: FastifyReply) =>
    reply
      .code(405)
      .header("Allow", "POST")
      .send({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);
}
