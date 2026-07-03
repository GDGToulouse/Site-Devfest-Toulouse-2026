import { describe, it, expect } from "vitest";
import { buildApp } from "./test-app.js";

describe("GET /api/contact/categories", () => {
  it("should return active contact categories", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/contact/categories" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const cat of body) {
      expect(cat).toHaveProperty("id");
      expect(cat).toHaveProperty("nameFr");
      expect(cat).toHaveProperty("nameEn");
    }
    await app.close();
  });
});

describe("POST /api/contact/send", () => {
  it("should reject empty submission with validation errors", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: { firstName: "", lastName: "", email: "", message: "" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.errors).toHaveProperty("firstName");
    expect(body.errors).toHaveProperty("lastName");
    expect(body.errors).toHaveProperty("email");
    expect(body.errors).toHaveProperty("message");
    await app.close();
  });

  it("should reject invalid email", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: {
        firstName: "Test",
        lastName: "User",
        email: "not-an-email",
        message: "This is a valid message with enough characters.",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.errors).toHaveProperty("email");
    await app.close();
  });

  it("should reject message too short", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        message: "Short",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.errors).toHaveProperty("message");
    await app.close();
  });

  it("should silently accept honeypot submissions", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: {
        firstName: "Bot",
        lastName: "Spam",
        email: "bot@spam.com",
        message: "I am a spam bot filling all fields.",
        website: "http://spam-link.com", // honeypot filled = bot
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    await app.close();
  });

  it("should accept valid submission and return success", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: {
        firstName: "Integration",
        lastName: "Test",
        email: "integration@test.com",
        company: "Test Corp",
        jobTitle: "QA Engineer",
        message: "This is an integration test message for the contact form.",
        categoryId: 1,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    await app.close();
  });
});
