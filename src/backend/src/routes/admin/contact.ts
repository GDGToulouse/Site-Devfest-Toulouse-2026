import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requireAdminRole } from "../../lib/admin-guard.js";

interface ContactCategoryBody {
  nameFr: string;
  nameEn: string;
  emailRecipients: string;
  sortOrder?: number;
  isActive?: boolean;
  slug?: string;
  confirmationSubjectFr?: string;
  confirmationSubjectEn?: string;
  confirmationBodyFr?: string;
  confirmationBodyEn?: string;
}

export default async function adminContactRoutes(app: FastifyInstance) {
  // GET /api/admin/contact/categories (ADMIN + EDITOR can read)
  app.get("/contact/categories", async () => {
    const categories = await prisma.contactCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { messages: true } } },
    });

    return categories.map((c) => ({
      id: c.id,
      nameFr: c.nameFr,
      nameEn: c.nameEn,
      emailRecipients: c.emailRecipients,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      slug: c.slug,
      isSystem: c.isSystem,
      confirmationSubjectFr: c.confirmationSubjectFr,
      confirmationSubjectEn: c.confirmationSubjectEn,
      confirmationBodyFr: c.confirmationBodyFr,
      confirmationBodyEn: c.confirmationBodyEn,
      messagesCount: c._count.messages,
    }));
  });

  // POST /api/admin/contact/categories (ADMIN only)
  app.post<{ Body: ContactCategoryBody }>("/contact/categories", { preHandler: [requireAdminRole] }, async (request, reply) => {
    const body = request.body;

    if (!body.nameFr?.trim() || !body.nameEn?.trim() || !body.emailRecipients?.trim()) {
      return reply.status(400).send({ error: "nameFr, nameEn, emailRecipients are required" });
    }

    const category = await prisma.contactCategory.create({
      data: {
        nameFr: body.nameFr.trim(),
        nameEn: body.nameEn.trim(),
        emailRecipients: body.emailRecipients.trim(),
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
        slug: body.slug?.trim() || null,
        confirmationSubjectFr: body.confirmationSubjectFr?.trim() || null,
        confirmationSubjectEn: body.confirmationSubjectEn?.trim() || null,
        confirmationBodyFr: body.confirmationBodyFr?.trim() || null,
        confirmationBodyEn: body.confirmationBodyEn?.trim() || null,
      },
    });

    return reply.status(201).send({ id: category.id });
  });

  // PUT /api/admin/contact/categories/:id (ADMIN only)
  app.put<{
    Params: { id: string };
    Body: Partial<ContactCategoryBody>;
  }>("/contact/categories/:id", { preHandler: [requireAdminRole] }, async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.contactCategory.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Category not found" });

    const body = request.body;

    const category = await prisma.contactCategory.update({
      where: { id },
      data: {
        nameFr: body.nameFr?.trim() ?? existing.nameFr,
        nameEn: body.nameEn?.trim() ?? existing.nameEn,
        emailRecipients: body.emailRecipients?.trim() ?? existing.emailRecipients,
        sortOrder: body.sortOrder ?? existing.sortOrder,
        isActive: body.isActive ?? existing.isActive,
        ...(existing.isSystem ? {} : { slug: body.slug !== undefined ? (body.slug?.trim() || null) : existing.slug }),
        confirmationSubjectFr: body.confirmationSubjectFr !== undefined ? (body.confirmationSubjectFr?.trim() || null) : existing.confirmationSubjectFr,
        confirmationSubjectEn: body.confirmationSubjectEn !== undefined ? (body.confirmationSubjectEn?.trim() || null) : existing.confirmationSubjectEn,
        confirmationBodyFr: body.confirmationBodyFr !== undefined ? (body.confirmationBodyFr?.trim() || null) : existing.confirmationBodyFr,
        confirmationBodyEn: body.confirmationBodyEn !== undefined ? (body.confirmationBodyEn?.trim() || null) : existing.confirmationBodyEn,
      },
    });

    return { id: category.id };
  });

  // DELETE /api/admin/contact/categories/:id (ADMIN only)
  app.delete<{
    Params: { id: string };
  }>("/contact/categories/:id", { preHandler: [requireAdminRole] }, async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.contactCategory.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Category not found" });

    if (existing.isSystem) {
      return reply.status(409).send({ error: "System categories cannot be deleted" });
    }

    await prisma.contactCategory.delete({ where: { id } });
    return { success: true };
  });

  // GET /api/admin/contact/messages — list messages with pagination
  app.get<{
    Querystring: { page?: string; limit?: string; unreadOnly?: string };
  }>("/contact/messages", async (request) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const limit = Math.min(Number(request.query.limit) || 20, 100);
    const unreadOnly = request.query.unreadOnly === "true";

    const where = unreadOnly ? { isRead: false } : {};

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: { select: { nameFr: true } } },
      }),
      prisma.contactMessage.count({ where }),
    ]);

    return {
      messages: messages.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        phone: m.phone,
        categoryLabel: m.category?.nameFr || m.categoryLabel,
        message: m.message,
        locale: m.locale,
        isRead: m.isRead,
        createdAt: m.createdAt,
        brochureDownloadCount: m.brochureDownloadCount,
        brochureDownloadedAt: m.brochureDownloadedAt,
        webhookStatus: m.webhookStatus,
        webhookAttemptedAt: m.webhookAttemptedAt,
        webhookError: m.webhookError,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  });

  // PUT /api/admin/contact/messages/:id/read — mark message as read
  app.put<{
    Params: { id: string };
  }>("/contact/messages/:id/read", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true },
    });

    return { success: true };
  });

  // DELETE /api/admin/contact/messages/:id (ADMIN only)
  app.delete<{
    Params: { id: string };
  }>("/contact/messages/:id", { preHandler: [requireAdminRole] }, async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    await prisma.contactMessage.delete({ where: { id } });
    return { success: true };
  });

  // POST /api/admin/contact/messages/:id/forward — forward message to email addresses
  app.post<{
    Params: { id: string };
    Body: { emails: string };
  }>("/contact/messages/:id/forward", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const msg = await prisma.contactMessage.findUnique({ where: { id } });
    if (!msg) return reply.status(404).send({ error: "Message not found" });

    const emails = request.body.emails
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      return reply.status(400).send({ error: "No valid email addresses" });
    }

    try {
      const { sendEmail } = await import("../../lib/email.js");
      await sendEmail({
        to: emails,
        subject: `[Fwd] Message de contact — ${msg.firstName} ${msg.lastName}`,
        text: `De: ${msg.firstName} ${msg.lastName}\nEmail: ${msg.email}${msg.phone ? `\nTel: ${msg.phone}` : ""}${msg.categoryLabel ? `\nCategorie: ${msg.categoryLabel}` : ""}\n\n${msg.message}`,
        html: `
        <h3>Message de contact transféré</h3>
        <p><strong>De:</strong> ${msg.firstName} ${msg.lastName}</p>
        <p><strong>Email:</strong> <a href="mailto:${msg.email}">${msg.email}</a></p>
        ${msg.phone ? `<p><strong>Tel:</strong> ${msg.phone}</p>` : ""}
        ${msg.categoryLabel ? `<p><strong>Categorie:</strong> ${msg.categoryLabel}</p>` : ""}
        <p><strong>Date:</strong> ${new Date(msg.createdAt).toLocaleString("fr-FR")}</p>
        <hr>
        <p>${msg.message.replace(/\n/g, "<br>")}</p>
        `,
      });
      return { success: true, forwardedTo: emails };
    } catch {
      return reply.status(500).send({ error: "Failed to send email" });
    }
  });

  // POST /api/admin/contact/messages/:id/retry-webhook — re-fire the
  // contact webhook for a stored message. Useful when the original POST
  // failed (target down, bad URL set then fixed, etc.). Returns the
  // outcome synchronously so the admin sees success/failure immediately.
  app.post<{ Params: { id: string } }>("/contact/messages/:id/retry-webhook", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const { buildPayloadFromStored, sendContactWebhook } = await import("../../lib/contact-webhook.js");
    const payload = await buildPayloadFromStored(id);
    if (!payload) return reply.status(404).send({ error: "Message not found" });

    const result = await sendContactWebhook(payload);
    return result;
  });
}
