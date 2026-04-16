import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@prisma/client";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "./auth.js";
import { prisma } from "./prisma.js";
import { extractPrefix, verifyApiKey } from "./api-key.js";

// Update `lastUsedAt` at most once per minute to avoid spamming the DB on
// high-traffic keys. Good enough for "seen recently" UI hints.
const LAST_USED_THROTTLE_MS = 60_000;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface AuthContext {
  user: AuthenticatedUser;
  source: "session" | "apiKey";
}

async function resolveSession(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  request.log.debug({ authPhase: "auth-context.session.try", hasCookie: !!request.headers.cookie });

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true, banned: true },
  });
  if (!user || user.banned) {
    request.log.debug({ authPhase: "auth-context.session.reject", reason: !user ? "no_user" : "banned" });
    return null;
  }
  request.log.debug({ authPhase: "auth-context.session.ok", role: user.role });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function resolveBearer(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const raw = authHeader.slice("Bearer ".length).trim();
  if (!raw) return null;

  const prefix = extractPrefix(raw);
  if (!prefix) {
    request.log.debug({ authPhase: "auth-context.bearer.reject", reason: "bad_format" });
    return null;
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { prefix },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, banned: true } },
    },
  });
  if (!apiKey) {
    request.log.debug({ authPhase: "auth-context.bearer.reject", reason: "unknown_prefix" });
    return null;
  }
  if (apiKey.revokedAt) {
    request.log.debug({ authPhase: "auth-context.bearer.reject", reason: "revoked", keyId: apiKey.id });
    return null;
  }
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
    request.log.debug({ authPhase: "auth-context.bearer.reject", reason: "expired", keyId: apiKey.id });
    return null;
  }
  if (apiKey.user.banned) {
    request.log.debug({ authPhase: "auth-context.bearer.reject", reason: "user_banned", keyId: apiKey.id });
    return null;
  }

  const ok = await verifyApiKey(raw, apiKey.hashedKey);
  if (!ok) {
    request.log.debug({ authPhase: "auth-context.bearer.reject", reason: "bad_hash", keyId: apiKey.id });
    return null;
  }

  // Throttled lastUsedAt refresh.
  const now = Date.now();
  const lastUsed = apiKey.lastUsedAt?.getTime() ?? 0;
  if (now - lastUsed > LAST_USED_THROTTLE_MS) {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(now) },
    });
  }

  request.log.debug({ authPhase: "auth-context.bearer.ok", keyId: apiKey.id, role: apiKey.user.role });
  return {
    id: apiKey.user.id,
    email: apiKey.user.email,
    name: apiKey.user.name,
    role: apiKey.user.role,
  };
}

/**
 * Resolve the current caller by trying (in order): a Better Auth session
 * cookie, then an `Authorization: Bearer <api-key>` header. Returns null
 * if neither succeeds. The caller's role reflects the DB state at request
 * time, so API tokens always mirror their owner's current role.
 */
export async function getAuthContext(request: FastifyRequest): Promise<AuthContext | null> {
  const sessionUser = await resolveSession(request);
  if (sessionUser) return { user: sessionUser, source: "session" };

  const apiKeyUser = await resolveBearer(request);
  if (apiKeyUser) return { user: apiKeyUser, source: "apiKey" };

  return null;
}

/**
 * preHandler that requires ANY authenticated back-office user (ADMIN or
 * EDITOR). Used for per-user routes such as `/api/me/*` where ownership
 * is enforced inside the handler.
 */
export async function requireAnyAuthenticated(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    reply.status(401).send({ error: "Unauthenticated" });
    return;
  }
  if (ctx.user.role !== "ADMIN" && ctx.user.role !== "EDITOR") {
    reply.status(403).send({ error: "Forbidden" });
    return;
  }
  (request as FastifyRequest & { authContext?: AuthContext }).authContext = ctx;
}
