process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { createHash, randomBytes } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import { registerAuthRoutes } from "../plugins/auth-routes.js";
import { auth, MCP_RESOURCE } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

// #514 — the site as an OAuth authorization server for MCP agents. Driven
// through the real better-auth handler, the way an agent and a browser would:
// discovery, authorize, sign-in on /connect, consent, code for token.

const PASSWORD = "mcp-oauth-test-1234!";
const REDIRECT_URI = "http://127.0.0.1:33418/callback";
const origin = new URL(MCP_RESOURCE).origin;
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let app: FastifyInstance;
const clientId = `mcp-test-${stamp()}`;
const created = { userIds: [] as string[] };

function cookiesOf(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.map((c) => c.split(";")[0]).join("; ");
}

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function createSponsorWithPassword() {
  const email = `mcp-${stamp()}@example.org`;
  const user = await prisma.user.create({ data: { email, name: "Mia Agent", role: "SPONSOR", emailVerified: true } });
  created.userIds.push(user.id);
  const ctx = await auth.$context;
  await prisma.account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: await ctx.password.hash(PASSWORD) },
  });
  return user;
}

function authorizeUrl(challenge: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "agent-state",
    scope: "openid offline_access",
    resource: MCP_RESOURCE,
  });
  return `/api/auth/oauth2/authorize?${params}`;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  await registerAuthRoutes(app);
  await app.ready();

  // A public client as a CIMD document would register it. Created directly:
  // resolving a real metadata document means fetching a public HTTPS URL.
  await prisma.oauthClient.create({
    data: {
      id: clientId,
      clientId,
      name: "Agent de test",
      redirectUris: [REDIRECT_URI],
      tokenEndpointAuthMethod: "none",
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      requirePKCE: true,
    },
  });
  await prisma.oauthClientResource.create({ data: { id: `${clientId}-mcp`, clientId, resourceId: MCP_RESOURCE } });
});

afterAll(async () => {
  await app.close();
  await prisma.oauthClient.delete({ where: { clientId } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: created.userIds } } });
});

describe("MCP OAuth discovery (#514)", () => {
  it("should describe /api/mcp as a resource this server protects", async () => {
    const res = await app.inject({ method: "GET", url: "/.well-known/oauth-protected-resource/api/mcp" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ resource: MCP_RESOURCE, authorization_servers: [`${origin}/api/auth`] });
  });

  it("should publish the authorization server, with metadata documents and without open registration", async () => {
    const res = await app.inject({ method: "GET", url: "/.well-known/oauth-authorization-server/api/auth" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      authorization_endpoint: `${origin}/api/auth/oauth2/authorize`,
      token_endpoint: `${origin}/api/auth/oauth2/token`,
      client_id_metadata_document_supported: true,
    });
    // Dynamic registration would let anyone create clients here.
    expect(res.json().registration_endpoint).toBeUndefined();
  });
});

describe("OAuth client management (#514)", () => {
  it("should refuse a signed-in sponsor creating an OAuth client", async () => {
    const user = await createSponsorWithPassword();
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin },
      payload: { email: user.email, password: PASSWORD },
    });
    const cookie = cookiesOf(signIn.headers["set-cookie"]);

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/oauth2/create-client",
      headers: { origin, cookie },
      payload: { redirect_uris: ["https://evil.example/cb"], client_name: "Mine" },
    });

    expect(res.statusCode).toBe(401);
    expect(await prisma.oauthClient.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("MCP OAuth authorization flow (#514)", () => {
  it("should send an agent with no session to /connect, with a signed request to resume", async () => {
    const res = await app.inject({ method: "GET", url: authorizeUrl(pkce().challenge) });

    expect(res.statusCode).toBe(302);
    const location = new URL(String(res.headers.location), origin);
    expect(location.pathname).toBe("/connect");
    expect(location.searchParams.get("sig")).toBeTruthy();
  });

  it("should accept a form-encoded token request instead of refusing it as an unknown media type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/oauth2/token",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        grant_type: "authorization_code",
        code: "not-a-code",
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: pkce().verifier,
      }).toString(),
    });

    expect(res.statusCode).not.toBe(415);
    expect(res.json().error).toBe("invalid_grant");
  });

  it("should resume from /connect once a session exists, however it was opened", async () => {
    // A magic link or Google/GitHub opens the session on another request than
    // the one /connect sends: the page comes back with a session and resumes.
    const user = await createSponsorWithPassword();
    const authorize = await app.inject({ method: "GET", url: authorizeUrl(pkce().challenge) });
    const connectQuery = new URL(String(authorize.headers.location), origin).search.slice(1);
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin },
      payload: { email: user.email, password: PASSWORD },
    });
    const cookie = cookiesOf(signIn.headers["set-cookie"]);

    const resume = await app.inject({
      method: "POST",
      url: "/api/auth/oauth2/continue",
      headers: { origin, cookie },
      payload: { postLogin: true, oauth_query: connectQuery },
    });

    expect(resume.statusCode).toBe(200);
    expect(new URL(resume.json().url, origin).pathname).toBe("/connect/consent");
  });

  it("should issue a token bound to /api/mcp once the person signs in and consents", async () => {
    const user = await createSponsorWithPassword();
    const { verifier, challenge } = pkce();

    // 1. The agent opens the authorize URL; no session, so off to /connect.
    const authorize = await app.inject({ method: "GET", url: authorizeUrl(challenge) });
    const connectQuery = new URL(String(authorize.headers.location), origin).search.slice(1);

    // 2. /connect signs the person in, handing back the signed request.
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin },
      payload: { email: user.email, password: PASSWORD, oauth_query: connectQuery },
    });
    expect(signIn.statusCode).toBe(200);
    const cookie = cookiesOf(signIn.headers["set-cookie"]);
    const consentUrl = new URL(signIn.json().url, origin);
    expect(consentUrl.pathname).toBe("/connect/consent");

    // 3. The consent page accepts, again with its own signed request.
    const consent = await app.inject({
      method: "POST",
      url: "/api/auth/oauth2/consent",
      headers: { origin, cookie },
      payload: { accept: true, oauth_query: consentUrl.search.slice(1) },
    });
    expect(consent.statusCode).toBe(200);
    const callback = new URL(consent.json().url, origin);
    expect(`${callback.origin}${callback.pathname}`).toBe(REDIRECT_URI);
    expect(callback.searchParams.get("state")).toBe("agent-state");

    // 4. The agent exchanges the code, form-encoded, proving PKCE.
    const token = await app.inject({
      method: "POST",
      url: "/api/auth/oauth2/token",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(callback.searchParams.get("code")),
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
        resource: MCP_RESOURCE,
      }).toString(),
    });

    expect(token.statusCode).toBe(200);
    const claims = JSON.parse(Buffer.from(token.json().access_token.split(".")[1], "base64url").toString());
    expect([claims.aud].flat()).toContain(MCP_RESOURCE);
    expect(claims.sub).toBe(user.id);
  });
});
