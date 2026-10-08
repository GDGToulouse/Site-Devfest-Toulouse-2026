process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import adminFaqRoutes from "../routes/admin/faq.js";
import faqRoutes from "../routes/faq.js";
import { prisma } from "../lib/prisma.js";

// #111 — the team writes the FAQ in the back-office; the public page gets the
// published questions, theme by theme, in the team's order.

// A prefix only these fixtures carry: the FAQ is site-wide, other files and
// the seeds may hold questions of their own.
const P = "Zq111";

let app: FastifyInstance;
const created: number[] = [];

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminFaqRoutes, { prefix: "/api/admin" });
  await app.register(faqRoutes, { prefix: "/api" });
});

afterAll(async () => {
  await prisma.faqItem.deleteMany({ where: { id: { in: created } } });
  await app.close();
});

async function create(payload: Record<string, unknown>) {
  const res = await app.inject({ method: "POST", url: "/api/admin/faq", payload });
  if (res.statusCode === 201) created.push(res.json().id);
  return res;
}

const publicQuestions = async () =>
  ((await app.inject({ method: "GET", url: "/api/faq" })).json() as { questionFr: string }[])
    .map((q) => q.questionFr)
    .filter((q) => q.startsWith(P));

describe("FAQ (#111)", () => {
  it("should create a question as a draft, kept off the public page", async () => {
    const res = await create({ questionFr: `${P} brouillon ?`, answerFr: "<p>Réponse</p>", theme: "TICKETS" });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ publicationStatus: "DRAFT", theme: "TICKETS" });
    expect(await publicQuestions()).not.toContain(`${P} brouillon ?`);
  });

  it("should serve the published questions theme by theme, then in the team's order", async () => {
    const other = (await create({ questionFr: `${P} autre ?`, theme: "OTHER", publicationStatus: "PUBLISHED" })).json();
    const b = (await create({ questionFr: `${P} accès B ?`, theme: "VENUE", publicationStatus: "PUBLISHED" })).json();
    const a = (await create({ questionFr: `${P} accès A ?`, theme: "VENUE", publicationStatus: "PUBLISHED" })).json();

    expect(await publicQuestions()).toEqual([`${P} accès B ?`, `${P} accès A ?`, `${P} autre ?`]);

    await app.inject({ method: "PUT", url: "/api/admin/faq/order", payload: { ids: [a.id, b.id, other.id] } });

    expect(await publicQuestions()).toEqual([`${P} accès A ?`, `${P} accès B ?`, `${P} autre ?`]);
  });

  it("should keep only safe HTML in an answer", async () => {
    const res = await create({ questionFr: `${P} html ?`, answerFr: '<p>Ok</p><script>alert(1)</script><img src=x onerror="alert(1)">' });

    expect(res.json().answerFr).toContain("<p>Ok</p>");
    expect(res.json().answerFr).not.toMatch(/script|onerror/);
  });

  it("should refuse a question without its French wording", async () => {
    const created = (await create({ questionFr: `${P} à vider ?` })).json();
    const res = await app.inject({ method: "PUT", url: `/api/admin/faq/${created.id}`, payload: { questionFr: "   " } });

    expect(res.statusCode).toBe(400);
  });

  it("should send a deleted question to the trash, off the public page", async () => {
    const item = (await create({ questionFr: `${P} à supprimer ?`, publicationStatus: "PUBLISHED" })).json();

    const res = await app.inject({ method: "DELETE", url: `/api/admin/faq/${item.id}` });

    expect(res.statusCode).toBe(204);
    expect((await prisma.faqItem.findUniqueOrThrow({ where: { id: item.id } })).deletedAt).not.toBeNull();
    expect(await publicQuestions()).not.toContain(`${P} à supprimer ?`);
  });
});
