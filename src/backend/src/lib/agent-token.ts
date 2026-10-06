import { createLocalJWKSet, errors, jwtVerify, type JSONWebKeySet } from "jose";

import { auth, AUTH_ISSUER, MCP_RESOURCE } from "./auth.js";
import { prisma } from "./prisma.js";

// The access token an AI agent presents (#514): a JWT the site itself signed
// when the person consented, bound to /api/mcp. Checked here rather than by
// calling better-auth over HTTP: the keys are ours, so the signature is
// verified locally, without the backend fetching its own public URL.

// Keys rotate rarely; a token signed by a key not seen yet forces a refresh.
const JWKS_CACHE_MS = 5 * 60_000;
let cache: { keys: ReturnType<typeof createLocalJWKSet>; at: number } | null = null;

async function keySet(isForced = false) {
  if (!isForced && cache && Date.now() - cache.at < JWKS_CACHE_MS) return cache.keys;
  const jwks = (await auth.api.getJwks()) as JSONWebKeySet;
  cache = { keys: createLocalJWKSet(jwks), at: Date.now() };
  return cache.keys;
}

async function verify(raw: string) {
  const options = { issuer: AUTH_ISSUER, audience: MCP_RESOURCE };
  try {
    return (await jwtVerify(raw, await keySet(), options)).payload;
  } catch (err) {
    if (!(err instanceof errors.JWKSNoMatchingKey)) throw err;
    return (await jwtVerify(raw, await keySet(true), options)).payload;
  }
}

export function looksLikeJwt(raw: string): boolean {
  return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw);
}

/**
 * The person and the agent behind a token, or null when it must be refused.
 *
 * A valid signature is not enough. A JWT cannot be recalled once issued, so the
 * consent the person gave this agent must still exist: withdrawing it (from
 * their account) cuts the agent off on its next call, not an hour later.
 */
export async function verifyAgentToken(raw: string): Promise<{ userId: string; clientId: string } | null> {
  let payload;
  try {
    payload = await verify(raw);
  } catch {
    return null;
  }

  const userId = payload.sub;
  const clientId = payload.client_id ?? payload.azp;
  // A client-credentials token acts for no one: nothing here to act as.
  if (typeof userId !== "string" || typeof clientId !== "string") return null;

  const consent = await prisma.oauthConsent.findFirst({ where: { clientId, userId }, select: { id: true } });
  return consent ? { userId, clientId } : null;
}
