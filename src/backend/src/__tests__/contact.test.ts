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

  it("should silently drop a honeypot submission with bot-like (invalid) fields", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: {
        firstName: "Bot",
        lastName: "",
        email: "not-an-email",
        message: "short",
        website: "http://spam-link.com", // honeypot filled + invalid fields = classic bot
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    await app.close();
  });

  it("should surface an error when the honeypot trips on an otherwise valid payload", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: {
        firstName: "Real",
        lastName: "User",
        email: "real@example.com",
        message: "A well-formed message a real user with autofill would send.",
        website: "http://autofilled.example", // honeypot filled but everything else valid
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.errors).toHaveProperty("honeypot");
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
