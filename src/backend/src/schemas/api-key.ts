import type { FastifyInstance } from "fastify";

export function registerApiKeySchemas(app: FastifyInstance) {
  app.addSchema({
    $id: "ApiKey",
    type: "object",
    required: ["id", "name", "prefix", "createdAt"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      prefix: { type: "string", description: "Préfixe public de la clé (12 caractères après dft_<env>_)" },
      lastUsedAt: { type: "string", format: "date-time", nullable: true },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      revokedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  });

  app.addSchema({
    $id: "ApiKeyWithUser",
    type: "object",
    required: ["id", "name", "prefix", "createdAt", "user"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      prefix: { type: "string" },
      lastUsedAt: { type: "string", format: "date-time", nullable: true },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      revokedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      user: {
        type: "object",
        required: ["id", "email", "role"],
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string", nullable: true },
          role: { type: "string", enum: ["ADMIN", "EDITOR"] },
        },
      },
    },
  });

  app.addSchema({
    $id: "CreatedApiKey",
    type: "object",
    required: ["id", "name", "prefix", "key", "createdAt"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      prefix: { type: "string" },
      key: {
        type: "string",
        description: "Valeur complète de la clé au format `dft_<env>_<random>`. N'est retournée qu'à la création.",
      },
      lastUsedAt: { type: "string", format: "date-time", nullable: true },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      revokedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  });
}
