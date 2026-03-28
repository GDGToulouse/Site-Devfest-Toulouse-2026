import { describe, it, expect } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";

describe("Admin Tickets API", () => {
  it("GET /api/admin/tickets should list ticket tiers", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/tickets" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    await app.close();
  });

  it("POST then PUT then DELETE a ticket tier", async () => {
    const app = await buildAdminApp();

    // Get an edition to link the ticket
    const editionsRes = await app.inject({ method: "GET", url: "/api/admin/editions" });
    const edition = editionsRes.json()[0];

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/tickets",
      payload: {
        nameFr: "Test Billet",
        nameEn: "Test Ticket",
        price: 42,
        status: "COMING_SOON",
        editionId: edition.id,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();

    // Update
    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/admin/tickets/${id}`,
      payload: { status: "AVAILABLE", price: 50 },
    });
    expect(updateRes.statusCode).toBe(200);

    // Delete
    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/tickets/${id}` });
    expect(delRes.statusCode).toBe(200);

    await app.close();
  });
});
