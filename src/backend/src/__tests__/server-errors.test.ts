import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../server.js";

// A failure must not tell an anonymous caller how the database is queried:
// the detail goes to the logs, not into the response. And a value the database
// cannot take is the caller's mistake, a 400, not a server error that pages
// the team.

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("error responses", () => {
  it("should refuse an edition year no integer column can hold, without the query", async () => {
    const res = await app.inject({ method: "GET", url: "/api/editions/9999999999999999999999" });

    expect(res.statusCode).toBe(400);
    expect(res.body.toLowerCase()).not.toContain("prisma");
  });

  it("should refuse a NUL byte in a slug, without the database's message", async () => {
    const res = await app.inject({ method: "GET", url: "/api/speakers/%00" });

    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain("invalid byte sequence");
  });
});

describe("a server error", () => {
  it("should answer without the error's message, keeping only a request id", async () => {
    const server = await buildServer();
    server.get("/api/test-server-error", async () => {
      throw new Error("secret detail from the depths");
    });
    await server.ready();

    const res = await server.inject({ method: "GET", url: "/api/test-server-error" });
    await server.close();

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("secret detail");
    expect(res.json().requestId).toBeTruthy();
  });
});
