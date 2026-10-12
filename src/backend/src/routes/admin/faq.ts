import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound, softDeleteData } from "../../lib/admin-helpers.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import { FAQ_THEMES, revalidateFaq } from "../../lib/faq.js";

// The FAQ in the back-office (#111): ADMIN and EDITOR, like the content pages.

interface FaqBody {
  theme?: (typeof FAQ_THEMES)[number];
  questionFr?: string;
  questionEn?: string;
  answerFr?: string;
  answerEn?: string;
  publicationStatus?: "DRAFT" | "PUBLISHED";
}

const bodySchema = {
  type: "object",
  properties: {
    theme: { type: "string", enum: [...FAQ_THEMES] },
    questionFr: { type: "string", maxLength: 500 },
    questionEn: { type: "string", maxLength: 500 },
    answerFr: { type: "string", maxLength: 20_000 },
    answerEn: { type: "string", maxLength: 20_000 },
    publicationStatus: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
  },
} as const;

const idParams = { type: "object", required: ["id"], properties: { id: { type: "string", pattern: "^[0-9]+$" } } } as const;

function clean(body: FaqBody) {
  return {
    ...(body.theme !== undefined && { theme: body.theme }),
    ...(body.questionFr !== undefined && { questionFr: body.questionFr.trim() }),
    ...(body.questionEn !== undefined && { questionEn: body.questionEn.trim() }),
    ...(body.answerFr !== undefined && { answerFr: sanitizeRichHtml(body.answerFr) }),
    ...(body.answerEn !== undefined && { answerEn: sanitizeRichHtml(body.answerEn) }),
    ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
  };
}

export default async function adminFaqRoutes(app: FastifyInstance) {
  // GET /api/admin/faq — every question, drafts included, in the page's order.
  app.get("/faq", async () => {
    const items = await prisma.faqItem.findMany({ where: notDeleted, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    return items.sort((a, b) => FAQ_THEMES.indexOf(a.theme) - FAQ_THEMES.indexOf(b.theme));
  });

  // POST /api/admin/faq — a new question, as a draft unless said otherwise,
  // at the end of its theme.
  app.post<{ Body: FaqBody }>("/faq", {
    schema: { body: { ...bodySchema, required: ["questionFr"] } },
  }, async (request, reply) => {
    const data = clean(request.body);
    if (!data.questionFr) return reply.code(400).send({ error: "question_required", message: "La question en français est obligatoire." });
    const theme = data.theme ?? "OTHER";
    const last = await prisma.faqItem.aggregate({ where: { ...notDeleted, theme }, _max: { sortOrder: true } });
    const item = await prisma.faqItem.create({
      data: { ...data, questionFr: data.questionFr, theme, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    if (item.publicationStatus === "PUBLISHED") await revalidateFaq(true);
    return reply.code(201).send(item);
  });

  // PUT /api/admin/faq/order — the order of the questions, as listed: each
  // question takes its position within its theme.
  app.put<{ Body: { ids: number[] } }>("/faq/order", {
    schema: {
      body: {
        type: "object",
        required: ["ids"],
        properties: { ids: { type: "array", items: { type: "integer", minimum: 1 }, maxItems: 500, uniqueItems: true } },
      },
    },
  }, async (request) => {
    await prisma.$transaction(
      request.body.ids.map((id, index) => prisma.faqItem.update({ where: { id }, data: { sortOrder: index } })),
    );
    await revalidateFaq(false);
    return { success: true };
  });

  // PUT /api/admin/faq/:id
  app.put<{ Params: { id: string }; Body: FaqBody }>("/faq/:id", {
    schema: { params: idParams, body: bodySchema },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const existing = await prisma.faqItem.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Question");
    const data = clean(request.body);
    if (data.questionFr === "") return reply.code(400).send({ error: "question_required", message: "La question en français est obligatoire." });
    const item = await prisma.faqItem.update({ where: { id }, data });
    await revalidateFaq(existing.publicationStatus !== item.publicationStatus);
    return item;
  });

  // DELETE /api/admin/faq/:id — to the trash (#146).
  app.delete<{ Params: { id: string } }>("/faq/:id", { schema: { params: idParams } }, async (request, reply) => {
    const id = Number(request.params.id);
    const existing = await prisma.faqItem.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Question");
    await prisma.faqItem.update({ where: { id }, data: softDeleteData() });
    await revalidateFaq(existing.publicationStatus === "PUBLISHED");
    return reply.code(204).send();
  });
}
