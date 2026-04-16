import type { FastifyInstance } from "fastify";

export function registerCommonSchemas(app: FastifyInstance) {
  app.addSchema({
    $id: "Error",
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string", description: "Code ou message court d'erreur" },
      message: { type: "string", description: "Message détaillé (optionnel)" },
    },
  });

  app.addSchema({
    $id: "Pagination",
    type: "object",
    required: ["page", "limit", "total"],
    properties: {
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1 },
      total: { type: "integer", minimum: 0 },
    },
  });
}
