import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../lib/email.js";

interface ContactBody {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  categoryId?: number;
  message: string;
  website?: string; // honeypot
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function contactRoutes(app: FastifyInstance) {
  // GET /api/contact/categories — public list of active categories
  app.get("/contact/categories", async () => {
    const categories = await prisma.contactCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return categories.map((cat) => ({
      id: cat.id,
      nameFr: cat.nameFr,
      nameEn: cat.nameEn,
    }));
  });

  // POST /api/contact/send — submit a contact message
  app.post<{ Body: ContactBody }>("/contact/send", async (request, reply) => {
    const { firstName, lastName, email, phone, categoryId, message, website } = request.body;

    // Honeypot check — bots fill this hidden field
    if (website) {
      // Silently accept but don't process
      return { success: true };
    }

    // Server-side validation
    const errors: Record<string, string> = {};
    if (!firstName?.trim()) errors.firstName = "required";
    if (!lastName?.trim()) errors.lastName = "required";
    if (!email?.trim() || !validateEmail(email)) errors.email = "invalid";
    if (!message?.trim() || message.trim().length < 10) errors.message = "too_short";

    if (Object.keys(errors).length > 0) {
      return reply.status(400).send({ success: false, errors });
    }

    // Resolve email recipients
    let recipients: string[] = [];
    let categoryLabel: string | null = null;

    if (categoryId) {
      const category = await prisma.contactCategory.findUnique({
        where: { id: categoryId },
      });
      if (category) {
        recipients = category.emailRecipients.split(",").map((e) => e.trim());
        categoryLabel = category.nameFr;
      }
    }

    // Fallback to default email
    if (recipients.length === 0) {
      const defaultEmail = await prisma.siteSetting.findUnique({
        where: { key: "contact_default_email" },
      });
      recipients = [defaultEmail?.value || "contact@devfesttoulouse.fr"];
    }

    // Store message in DB
    await prisma.contactMessage.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        categoryLabel,
        message: message.trim(),
        categoryId: categoryId || null,
      },
    });

    // Send email
    try {
      const subject = `Nouveau message de contact — ${firstName.trim()} ${lastName.trim()}`;
      const text = [
        `De: ${firstName.trim()} ${lastName.trim()}`,
        `Email: ${email.trim()}`,
        phone ? `Téléphone: ${phone.trim()}` : null,
        categoryLabel ? `Catégorie: ${categoryLabel}` : null,
        "",
        message.trim(),
      ]
        .filter(Boolean)
        .join("\n");

      const html = `
        <h3>Nouveau message de contact</h3>
        <p><strong>De:</strong> ${firstName.trim()} ${lastName.trim()}</p>
        <p><strong>Email:</strong> <a href="mailto:${email.trim()}">${email.trim()}</a></p>
        ${phone ? `<p><strong>Téléphone:</strong> ${phone.trim()}</p>` : ""}
        ${categoryLabel ? `<p><strong>Catégorie:</strong> ${categoryLabel}</p>` : ""}
        <hr>
        <p>${message.trim().replace(/\n/g, "<br>")}</p>
      `;

      await sendEmail({ to: recipients, subject, text, html });
    } catch (err) {
      app.log.error("Failed to send contact email: %s", String(err));
      // Message is saved in DB even if email fails
    }

    return { success: true };
  });
}
