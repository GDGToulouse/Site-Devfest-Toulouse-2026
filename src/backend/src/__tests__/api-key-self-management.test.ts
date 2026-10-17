import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminRoutes from "../routes/admin/index.js";
import myApiKeysRoutes from "../routes/me/api-keys.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";
import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";

// A key is managed by its person, from the browser. A key that could mint,
// rotate or revoke keys would outlive its own expiry and revocation: whoever
// held a leaked one would keep a fresh one after it was cut off.

const PASSWORD = "key-mgmt-test-1234!";
let app: FastifyInstance;
let userId: string;
let bearer: string;
let keyId: string;
let cookie: string;

beforeAll(async () => {
  app = Fastify({ logger: false });
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await app.register(myApiKeysRoutes, { prefix: "/api/me" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.ready();

  const email = `key-mgmt-${Date.now()}@example.org`;
  const user = await prisma.user.create({ data: { email, name: "Key mgmt", role: "ADMIN", emailVerified: true } });
  userId = user.id;
  const key = await generateApiKey(resolveApiKeyEnv());
  const row = await prisma.apiKey.create({
    data: { name: "key-mgmt-test", prefix: key.prefix, hashedKey: key.hashedKey, userId },
  });
  bearer = key.raw;
  keyId = row.id;

  const ctx = await auth.$context;
  await prisma.account.create({
    data: { userId, accountId: userId, providerId: "credential", password: await ctx.password.hash(PASSWORD) },
  });
  const { headers } = await auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
  cookie = (headers.get("set-cookie") ?? "").split(",").map((c) => c.split(";")[0].trim()).join("; ");
});

afterAll(async () => {
  await app.close();
  await prisma.apiKey.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("API keys are managed from the browser, never by a key", () => {
  it("should refuse a key that creates a key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/me/api-keys",
      headers: { authorization: `Bearer ${bearer}` },
      payload: { name: "minted-by-a-key" },
    });

    expect(res.statusCode).toBe(403);
    expect(await prisma.apiKey.count({ where: { userId, name: "minted-by-a-key" } })).toBe(0);
  });

  it("should refuse a key that rotates or revokes keys", async () => {
    const rotate = await app.inject({
      method: "POST",
      url: `/api/me/api-keys/${keyId}/rotate`,
      headers: { authorization: `Bearer ${bearer}` },
    });
    const revoke = await app.inject({
      method: "DELETE",
      url: `/api/admin/api-keys/${keyId}`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(rotate.statusCode).toBe(403);
    expect(revoke.statusCode).toBe(403);
  });

  it("should still let the person create a key from the browser", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/me/api-keys",
      headers: { cookie },
      payload: { name: "made-in-the-browser" },
    });

    expect(res.statusCode).toBe(201);
  });
});
