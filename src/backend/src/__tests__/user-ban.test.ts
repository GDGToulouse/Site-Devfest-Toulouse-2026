process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminRoutes from "../routes/admin/index.js";
import { registerAuthRoutes } from "../plugins/auth-routes.js";
import { registerRequestContext } from "../lib/request-context.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { createUserWithPassword, signInCookie } from "./agent-test-helpers.js";

// A ban withdraws everything the account holds, as it already did for its AI
// agents (#514): lifting it must not hand back keys, nor sessions opened while
// it held (#658).

let app: FastifyInstance;
const createdUserIds: string[] = [];

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("adminUser");
  registerRequestContext(app);
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await registerAuthRoutes(app);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.apiKey.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function account(role: "ADMIN" | "EDITOR", name: string) {
  const user = await createUserWithPassword(role, name);
  createdUserIds.push(user.id);
  return user;
}

async function toggleBan(userId: string, cookie: string) {
  return app.inject({ method: "PUT", url: `/api/admin/users/${userId}/ban`, headers: { cookie } });
}

describe("banning an account", () => {
  it("should revoke its API keys for good", async () => {
    const admin = await account("ADMIN", "Ban Admin");
    const editor = await account("EDITOR", "Ban Editor");
    const key = await generateApiKey(resolveApiKeyEnv());
    const row = await prisma.apiKey.create({
      data: { name: "ban-test", prefix: key.prefix, hashedKey: key.hashedKey, userId: editor.id },
    });
    const cookie = await signInCookie(app, admin.email);

    await toggleBan(editor.id, cookie);
    await toggleBan(editor.id, cookie);

    expect((await prisma.apiKey.findUniqueOrThrow({ where: { id: row.id } })).revokedAt).not.toBeNull();
  });

  it("should refuse to open a session while the ban holds", async () => {
    const admin = await account("ADMIN", "Ban Admin 2");
    const editor = await account("EDITOR", "Ban Editor 2");
    const cookie = await signInCookie(app, admin.email);
    await toggleBan(editor.id, cookie);

    await signInCookie(app, editor.email);

    expect(await prisma.session.count({ where: { userId: editor.id } })).toBe(0);
  });
});
