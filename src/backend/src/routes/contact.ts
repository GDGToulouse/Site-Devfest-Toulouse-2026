import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendEmail, interpolate } from "../lib/email.js";
import { getFeaturedEdition } from "./editions.js";

interface ContactBody {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  categoryId?: number;
  message: string;
  locale?: string;
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

    return categories.map((cat: (typeof categories)[number]) => ({
      id: cat.id,
      nameFr: cat.nameFr,
      nameEn: cat.nameEn,
      slug: cat.slug,
    }));
  });

  // POST /api/contact/send — submit a contact message
  // Rate limit: 5 messages per 15 minutes per IP
  app.post<{ Body: ContactBody }>("/contact/send", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "15 minutes",
      },
    },
  }, async (request, reply) => {
    const { firstName, lastName, email, phone, categoryId, message, locale, website } = request.body;

    // Honeypot check — bots fill this hidden field
    if (website) {
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

    // Resolve category + recipients
    let recipients: string[] = [];
    let categoryLabel: string | null = null;
    let category: Awaited<ReturnType<typeof prisma.contactCategory.findUnique>> = null;

    if (categoryId) {
      category = await prisma.contactCategory.findUnique({
        where: { id: categoryId },
      });
      if (category) {
        recipients = category.emailRecipients.split(",").map((e: string) => e.trim());
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
    const stored = await prisma.contactMessage.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        categoryLabel,
        message: message.trim(),
        locale: locale || null,
        categoryId: categoryId || null,
      },
    });

    // --- Send notification email to recipients (existing behaviour) ---
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
    }

    // --- Send confirmation email to the person who submitted the form ---
    if (category) {
      const lang = locale === "en" ? "en" : "fr";
      const tplSubject = lang === "en" ? category.confirmationSubjectEn : category.confirmationSubjectFr;
      const tplBody = lang === "en" ? category.confirmationBodyEn : category.confirmationBodyFr;

      if (tplSubject && tplBody) {
        try {
          const edition = await getFeaturedEdition();
          const baseUrl = process.env.BASE_URL || "http://localhost:3000";
          const brochureUrl = edition?.sponsorBrochureUrl
            ? `${baseUrl}${edition.sponsorBrochureUrl}`
            : "";

          const vars = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            brochureUrl,
          };

          const renderedSubject = interpolate(tplSubject, vars);
          const renderedBody = interpolate(tplBody, vars);

          await sendEmail({
            to: [email.trim()],
            subject: renderedSubject,
            text: renderedBody.replace(/<[^>]+>/g, ""),
            html: renderedBody.replace(/\n/g, "<br>"),
          });
        } catch (err) {
          app.log.error("Failed to send confirmation email: %s", String(err));
        }
      }
    }

    // --- Fire webhook (async, fire-and-forget) ---
    try {
      const edition = await getFeaturedEdition();
      if (edition?.contactWebhookUrl) {
        const payload = {
          id: stored.id,
          submittedAt: stored.createdAt.toISOString(),
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone?.trim() || null,
            categoryId: categoryId || null,
            categorySlug: category?.slug || null,
            categoryLabel: categoryLabel || null,
            message: message.trim(),
            locale: locale || null,
          },
        };

        fetch(edition.contactWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        }).catch((err) => {
          app.log.warn("Contact webhook failed: %s", String(err));
        });
      }
    } catch (err) {
      app.log.warn("Contact webhook error: %s", String(err));
    }

    return { success: true };
  });
}
