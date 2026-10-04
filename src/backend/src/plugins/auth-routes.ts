import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { auth } from "../lib/auth.js";
import { authRateLimit } from "../lib/rate-limit-options.js";

/**
 * Hand every auth request to better-auth. Strict budget on sign-in, sign-up and
 * password reset; a wider one, in its own bucket, for the MCP connector's OAuth
 * endpoints (rate-limit-options.ts).
 *
 * OAuth clients post `application/x-www-form-urlencoded` (RFC 6749) to the
 * token and revocation endpoints (#514). Fastify has no parser for it, so it
 * answered 415 before better-auth saw the request. Registered in this scope
 * only: the rest of the API keeps refusing forms. The raw string is forwarded
 * untouched — re-encoding it would drop repeated keys.
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  await app.register(async (authApp) => {
    authApp.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_request, body, done) => done(null, body),
    );

    const config = { rateLimit: authRateLimit };
    authApp.route({ method: ["GET", "POST"], url: "/api/auth/*", config, handler: forwardToAuth });
    // Discovery documents live at the origin root (RFC 8414, RFC 9728): an MCP
    // client looks for /.well-known/oauth-protected-resource/api/mcp, not under
    // /api/auth. better-auth recognises those paths itself.
    authApp.route({ method: "GET", url: "/.well-known/*", config, handler: forwardToAuth });
  });
}

async function forwardToAuth(request: FastifyRequest, reply: FastifyReply) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  request.log.debug({
    authPhase: "proxy.incoming",
    url: request.url,
    method: request.method,
    hasCookie: !!request.headers.cookie,
    cookiePrefix: request.headers.cookie ? request.headers.cookie.slice(0, 60) : null,
    origin: request.headers.origin,
  });

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.append(key, Array.isArray(value) ? value.join(", ") : value);
  }

  // A form arrives as its raw string (see the parser above); JSON was parsed.
  const body = typeof request.body === "string" ? request.body : request.body ? JSON.stringify(request.body) : undefined;
  const req = new Request(url.toString(), {
    method: request.method,
    headers,
    ...(body !== undefined ? { body } : {}),
  });

  const response = await auth.handler(req);

  request.log.debug({ authPhase: "proxy.response", status: response.status });

  // Log failed auth attempts for security monitoring
  if (response.status >= 400 && request.url.includes("sign-in")) {
    request.log.warn({ ip: request.ip, url: request.url, status: response.status }, "Failed login attempt");
  }

  reply.status(response.status);
  response.headers.forEach((value, key) => reply.header(key, value));

  const responseBody = await response.text();
  return reply.send(responseBody || null);
}
