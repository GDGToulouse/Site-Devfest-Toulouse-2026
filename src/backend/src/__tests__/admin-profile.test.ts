process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminAuthRoutes from "../routes/admin/auth.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";

// #514 — found by the API rights audit: the profile route had no body schema,
// so a malformed name reached `.trim()` and answered 500 instead of 400.

let app: FastifyInstance;
let bearer: string;
let userId: string;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminAuthRoutes, { prefix: "/api/admin" });
  await app.ready();
  const user = await prisma.user.create({
    data: { email: `profile-${Date.now()}@example.org`, name: "Pro File", role: "EDITOR" },
  });
  userId = user.id;
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({ data: { name: "profile", prefix: key.prefix, hashedKey: key.hashedKey, userId } });
  bearer = key.raw;
});

afterAll(async () => {
  await app.close();
  await prisma.user.delete({ where: { id: userId } });
  await prisma.auditLog.deleteMany({ where: { entityId: userId } });
});

describe("PUT /api/admin/profile", () => {
  it("should refuse a name that is not text with a 400, not crash", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/profile",
      headers: { authorization: `Bearer ${bearer}` },
      payload: { name: { not: "a string" } },
    });

    expect(res.statusCode).toBe(400);
  });

  it("should still rename the caller", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/profile",
      headers: { authorization: `Bearer ${bearer}` },
      payload: { name: "  New Name  " },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe("New Name");
  });
});
