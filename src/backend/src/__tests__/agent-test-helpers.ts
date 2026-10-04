import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";

import { auth, MCP_RESOURCE } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

// A real agent token for tests (#514), obtained the way an agent gets one:
// authorize, sign in with the signed request, consent, exchange the code. The
// app passed in must carry registerAuthRoutes.

const PASSWORD = "agent-test-1234!";
const REDIRECT_URI = "http://127.0.0.1:33418/callback";
const origin = new URL(MCP_RESOURCE).origin;
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function cookiesOf(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.map((c) => c.split(";")[0]).join("; ");
}

export async function createAgentClient(name = "Agent de test") {
  const clientId = `agent-${stamp()}`;
  await prisma.oauthClient.create({
    data: {
      id: clientId,
      clientId,
      name,
      redirectUris: [REDIRECT_URI],
      tokenEndpointAuthMethod: "none",
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      requirePKCE: true,
    },
  });
  await prisma.oauthClientResource.create({ data: { id: `${clientId}-mcp`, clientId, resourceId: MCP_RESOURCE } });
  return clientId;
}

export async function createUserWithPassword(role: "ADMIN" | "EDITOR" | "SPONSOR", name: string) {
  const user = await prisma.user.create({
    data: { email: `agent-${role.toLowerCase()}-${stamp()}@example.org`, name, role, emailVerified: true },
  });
  const ctx = await auth.$context;
  await prisma.account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: await ctx.password.hash(PASSWORD) },
  });
  return user;
}

/** A browser session for `email`, as the cookie header to send back. */
export async function signInCookie(app: FastifyInstance, email: string): Promise<string> {
  const signIn = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { origin },
    payload: { email, password: PASSWORD },
  });
  return cookiesOf(signIn.headers["set-cookie"]);
}

/** Run the whole authorization for `email` and return the agent's access token. */
export async function obtainAgentToken(app: FastifyInstance, clientId: string, email: string): Promise<string> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "s",
    scope: "openid offline_access",
    resource: MCP_RESOURCE,
  });

  const authorize = await app.inject({ method: "GET", url: `/api/auth/oauth2/authorize?${params}` });
  const connectQuery = new URL(String(authorize.headers.location), origin).search.slice(1);
  const signIn = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { origin },
    payload: { email, password: PASSWORD, oauth_query: connectQuery },
  });
  const cookie = cookiesOf(signIn.headers["set-cookie"]);
  const consentQuery = new URL(signIn.json().url, origin).search.slice(1);
  const consent = await app.inject({
    method: "POST",
    url: "/api/auth/oauth2/consent",
    headers: { origin, cookie },
    payload: { accept: true, oauth_query: consentQuery },
  });
  const code = new URL(consent.json().url, origin).searchParams.get("code");
  const token = await app.inject({
    method: "POST",
    url: "/api/auth/oauth2/token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
      resource: MCP_RESOURCE,
    }).toString(),
  });
  return token.json().access_token;
}
