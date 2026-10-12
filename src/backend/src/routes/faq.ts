import type { FastifyInstance } from "fastify";
import { publishedFaq } from "../lib/faq.js";

export default async function faqRoutes(app: FastifyInstance) {
  // GET /api/faq — the published questions of the FAQ (#111), both languages:
  // the page picks its own and falls back on French where English is missing.
  app.get("/faq", async () => publishedFaq());
}
