// Module augmentation: extend Fastify's request typings with the
// per-request decorations attached by our auth middleware. Keeps route
// handlers free of `as` casts when reading request.adminUser /
// request.authContext.

import type { AuthContext } from "../lib/auth-context.js";

declare module "fastify" {
  interface FastifyRequest {
    adminUser?: AuthContext["user"];
    authContext?: AuthContext;
  }
}
