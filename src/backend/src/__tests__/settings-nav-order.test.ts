process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// The header is on every page: saving the order purges the whole site.
vi.mock("../lib/revalidate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/revalidate.js")>()),
  revalidateAll: vi.fn().mockResolvedValue({ ok: true }),
}));

const { default: adminSettingsRoutes } = await import("../routes/admin/settings.js");
const { default: settingsRoutes } = await import("../routes/settings.js");
const { revalidateAll } = await import("../lib/revalidate.js");
const { prisma } = await import("../lib/prisma.js");
const { NAV_ORDER_KEY, parseNavOrder } = await import("../lib/nav-order.js");

// #606 — the menu's top-level order, set from the admin, read by the site.

let app: FastifyInstance;
let previous: string | null = null;

beforeAll(async () => {
  previous = (await prisma.siteSetting.findUnique({ where: { key: NAV_ORDER_KEY } }))?.value ?? null;
  app = Fastify({ logger: false });
  await app.register(adminSettingsRoutes, { prefix: "/api/admin" });
  await app.register(settingsRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (previous === null) await prisma.siteSetting.deleteMany({ where: { key: NAV_ORDER_KEY } });
  else await prisma.siteSetting.update({ where: { key: NAV_ORDER_KEY }, data: { value: previous } });
});

describe("Menu order (#606)", () => {
  it("stores the order, purges the site, and serves it to the header", async () => {
    const order = ["blog", "page-accessibilite", "programme", "speakers"];

    const put = await app.inject({ method: "PUT", url: "/api/admin/settings/menu", payload: { order } });
    const read = await app.inject({ method: "GET", url: "/api/settings/nav-order" });

    expect(put.statusCode).toBe(200);
    expect(revalidateAll).toHaveBeenCalled();
    expect(read.json()).toEqual({ order });
  });

  it("refuses a key that is no menu slot", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/admin/settings/menu", payload: { order: ["programme", "<script>"] } });

    expect(res.statusCode).toBe(400);
  });
});

describe("parseNavOrder (#606)", () => {
  it("reads a broken value as the code's order rather than failing every page", () => {
    expect(parseNavOrder("{not json")).toEqual([]);
    expect(parseNavOrder('["blog", 3, "evil key"]')).toEqual(["blog"]);
  });
});
