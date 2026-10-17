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

// The form is public and anonymous: a malformed body must be refused at the
// door, cheaply, never reach the handler's string calls nor the mailer.
describe("POST /api/contact/send — body bounds", () => {
  it("should accept the optional fields as null", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: {
        firstName: "Null",
        lastName: "Fields",
        email: "null-fields@test.com",
        phone: null,
        company: null,
        jobTitle: null,
        categoryId: null,
        message: "Optional fields sent as null by the form.",
        locale: null,
        confirmUrl: null,
      },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("should refuse a non-text name with a 400, not a 500", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: { firstName: { first: "a" }, lastName: "x", email: "a@b.cd", message: "0123456789xx" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("should refuse an oversized address quickly", async () => {
    const app = await buildApp();
    const started = performance.now();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: { firstName: "a", lastName: "b", email: `a@${".".repeat(30_000)}@`, message: "0123456789xx" },
    });
    const elapsed = performance.now() - started;
    expect(res.statusCode).toBe(400);
    expect(elapsed).toBeLessThan(200);
    await app.close();
  });

  it("should refuse a name longer than a name", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: { firstName: "a".repeat(101), lastName: "b", email: "a@b.cd", message: "0123456789xx" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("should refuse a body far larger than any real message", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contact/send",
      payload: { firstName: "a", lastName: "b", email: "a@b.cd", message: "x".repeat(200_000) },
    });
    expect([400, 413]).toContain(res.statusCode);
    await app.close();
  });
});
