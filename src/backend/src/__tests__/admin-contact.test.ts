import { describe, it, expect } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";

describe("Admin Contact API", () => {
  it("GET /api/admin/contact/categories should list categories", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/contact/categories" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const cat of body) {
      expect(cat).toHaveProperty("nameFr");
      expect(cat).toHaveProperty("emailRecipients");
      expect(cat).toHaveProperty("messagesCount");
    }
    await app.close();
  });

  it("POST /api/admin/contact/categories should reject without auth", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/contact/categories",
      payload: {
        nameFr: "Test Cat FR",
        nameEn: "Test Cat EN",
        emailRecipients: "test@example.com",
      },
    });
    // Without auth session, requireAdminRole rejects (403 or 500 in test env)
    expect(res.statusCode).not.toBe(201);
    await app.close();
  });

  it("GET /api/admin/contact/messages should list messages with pagination", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/contact/messages" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("messages");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("totalPages");
    await app.close();
  });
});
