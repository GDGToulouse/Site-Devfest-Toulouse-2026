import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import articleRoutes from "../routes/articles.js";
import calendarRoutes from "../routes/calendar.js";
import editionRoutes from "../routes/editions.js";
import replayRoutes from "../routes/replays.js";

// A number taken from a public URL must never reach Prisma unchecked (#703).
// `Number()` lets through what an Int column refuses — "1.5", "Infinity",
// "1e10" — and the query then throws: a 500 that fires the 5xx alert (#118)
// for every made-up URL a crawler tries.
const NOT_A_YEAR = ["abc", "NaN", "1.5", "Infinity", "1e10", "0x7E9", "99999999999", "-2025"];
const NOT_A_PAGE = ["1.5", "1.1", "Infinity", "1e999", "-1", "abc"];

async function buildApp() {
  const app = Fastify({ logger: false });
  for (const routes of [editionRoutes, calendarRoutes, replayRoutes, articleRoutes]) {
    await app.register(routes, { prefix: "/api" });
  }
  return app;
}

describe("public routes with a year in the path (#703)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  const routes = [
    (y: string) => `/api/editions/${y}`,
    (y: string) => `/api/editions/${y}/speakers`,
    (y: string) => `/api/editions/${y}/sponsors`,
    (y: string) => `/api/editions/${y}/talks`,
    (y: string) => `/api/editions/${y}/schedule`,
    (y: string) => `/api/editions/${y}/talks/some-talk`,
    (y: string) => `/api/editions/${y}/schedule.ics`,
  ];

  for (const route of routes) {
    it(`rejects a year that is not one on ${route(":year")}`, async () => {
      for (const year of NOT_A_YEAR) {
        const res = await app.inject({ method: "GET", url: route(encodeURIComponent(year)) });
        expect({ year, status: res.statusCode }).toEqual({ year, status: 400 });
      }
    });
  }

  it("still answers 404 for a well-formed year with no edition", async () => {
    const res = await app.inject({ method: "GET", url: "/api/editions/1066" });
    expect(res.statusCode).toBe(404);
  });
});

describe("public routes with a number in the query string (#703)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it("rejects a replay year filter that is not a year", async () => {
    for (const year of NOT_A_YEAR) {
      const res = await app.inject({ method: "GET", url: `/api/replays?year=${encodeURIComponent(year)}` });
      expect({ year, status: res.statusCode }).toEqual({ year, status: 400 });
    }
  });

  // Not a number, but the same fault (#752): an unknown format reached Prisma
  // as an enum value it refuses.
  it("rejects a replay format filter that is not a talk format", async () => {
    for (const format of ["FOO", "keynote", "KEYNOTE "]) {
      const res = await app.inject({ method: "GET", url: `/api/replays?format=${encodeURIComponent(format)}` });
      expect({ format, status: res.statusCode }).toEqual({ format, status: 400 });
    }
  });

  it("accepts a known replay format, or none", async () => {
    for (const format of ["KEYNOTE", ""]) {
      const res = await app.inject({ method: "GET", url: `/api/replays?format=${format}` });
      expect({ format, status: res.statusCode }).toEqual({ format, status: 200 });
    }
  });

  // The article list degrades to its defaults rather than refusing: these are
  // the page's own controls, and the page reads them from its own URL.
  it("falls back to the first page for a page number that is not one", async () => {
    for (const page of NOT_A_PAGE) {
      const res = await app.inject({ method: "GET", url: `/api/articles?page=${encodeURIComponent(page)}` });
      expect({ page, status: res.statusCode }).toEqual({ page, status: 200 });
      expect(res.json().page).toBe(1);
    }
  });

  it("ignores a limit or an edition id that is not a whole number", async () => {
    for (const value of NOT_A_PAGE) {
      const v = encodeURIComponent(value);
      for (const url of [`/api/articles?limit=${v}&editionId=${v}`, `/api/articles/latest?limit=${v}&editionId=${v}`]) {
        const res = await app.inject({ method: "GET", url });
        expect({ url, status: res.statusCode }).toEqual({ url, status: 200 });
      }
    }
  });
});
