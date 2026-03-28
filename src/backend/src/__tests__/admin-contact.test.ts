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

  it("POST then PUT then DELETE a contact category", async () => {
    const app = await buildAdminApp();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/contact/categories",
      payload: {
        nameFr: "Test Cat FR",
        nameEn: "Test Cat EN",
        emailRecipients: "test@example.com",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();

    // Update
    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/admin/contact/categories/${id}`,
      payload: { nameFr: "Test Cat FR Updated" },
    });
    expect(updateRes.statusCode).toBe(200);

    // Delete
    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/contact/categories/${id}` });
    expect(delRes.statusCode).toBe(200);

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
