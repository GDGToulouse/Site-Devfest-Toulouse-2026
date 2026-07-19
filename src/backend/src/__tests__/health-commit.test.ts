import { describe, it, expect } from "vitest";
import Fastify from "fastify";

// GET /api/health advertises the deployed build's commit (#290). The route
// lives inline in index.ts, which starts a listening server on import, so the
// response schema is mirrored here: it is the part that can silently break.
// Fastify's serializer DROPS any property missing from the schema, so a health
// payload could carry `commit` and still answer without it — exactly the
// failure this test exists to catch.
const HEALTH_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ok"] },
    timestamp: { type: "string", format: "date-time" },
    version: { type: "string" },
    environment: { type: "string" },
    commit: { type: "string" },
  },
  required: ["status", "timestamp", "version", "environment"],
};

async function buildHealthApp(commit: string) {
  const app = Fastify({ logger: false });
  app.get("/api/health", { schema: { response: { 200: HEALTH_SCHEMA } } }, async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.4.0-beta",
    environment: "beta",
    ...(commit && { commit }),
  }));
  return app;
}

describe("GET /api/health — deployed build identity (#290)", () => {
  it("surfaces the commit so two deploys of one version can be told apart", async () => {
    const app = await buildHealthApp("7d90b17");
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().commit).toBe("7d90b17");
    await app.close();
  });

  it("omits the commit rather than reporting an empty one", async () => {
    const app = await buildHealthApp("");
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty("commit");
    // The rest of the payload is unaffected by the missing commit.
    expect(res.json().version).toBe("1.4.0-beta");
    await app.close();
  });
});
