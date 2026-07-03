import { describe, it, expect } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";

describe("Admin Editions API", () => {
  it("GET /api/admin/editions should list editions", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/editions" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("year");
    expect(body[0]).toHaveProperty("status");
    await app.close();
  });

  it("GET /api/admin/editions/current should return current edition", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/editions/current" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("year");
    expect(body).toHaveProperty("status");
    await app.close();
  });

  it("PUT /api/admin/editions/:id should update edition", async () => {
    const app = await buildAdminApp();
    // Get current edition first
    const listRes = await app.inject({ method: "GET", url: "/api/admin/editions" });
    const editions = listRes.json();
    const edition = editions[0];

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${edition.id}`,
      payload: { status: edition.status }, // Same status, just test the endpoint
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("id", edition.id);
    await app.close();
  });
});
