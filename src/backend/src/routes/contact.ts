import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendEmail, interpolate, interpolateHtml } from "../lib/email.js";
import { makeToken } from "../lib/brochure-token.js";
import { sendContactWebhook } from "../lib/contact-webhook.js";
import { getFeaturedEdition } from "./editions.js";

interface ContactBody {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  categoryId?: number;
  message: string;
  locale?: string;
  // Honeypot. Accepts both the new `confirmUrl` (current front) and the
  // old `website` field in case a cached build is still out there.
  confirmUrl?: string;
  website?: string;
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
    const { firstName, lastName, email, phone, categoryId, message, locale, confirmUrl, website } = request.body;

    // Honeypot check — bots fill this hidden field. We silently succeed
    // (200 OK) so bots can't tell they were caught, but we log on the
    // server so legitimate users trapped by aggressive autofill show up
    // in the logs instead of "my message vanished without a trace".
    const honeypotValue = confirmUrl || website;
    if (honeypotValue) {
      request.log.warn(
        { ip: request.ip, email, honeypotValue: honeypotValue.slice(0, 80) },
        "[contact] honeypot tripped — submission silently dropped",
      );
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
          // Per-message tracked link if both the brochure and the signing
          // secret are configured; falls back to the raw URL otherwise so
          // the email stays useful in dev.
          const brochureToken = makeToken(stored.id);
          const brochureUrl = edition?.sponsorBrochureUrl
            ? brochureToken
              ? `${baseUrl}/api/brochure/${brochureToken}`
              : `${baseUrl}${edition.sponsorBrochureUrl}`
            : "";

          const vars = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            brochureUrl,
          };

          // Subject is plain-text, use plain interpolation (values not HTML-escaped).
          // Body has two renderings: plain-text for `text` (strip tags after
          // interpolation) and HTML for `html` (escape values to avoid XSS).
          const renderedSubject = interpolate(tplSubject, vars);
          const renderedTextBody = interpolate(tplBody, vars).replace(/<[^>]+>/g, "");
          const renderedHtmlBody = interpolateHtml(tplBody, vars).replace(/\n/g, "<br>");

          await sendEmail({
            to: [email.trim()],
            subject: renderedSubject,
            text: renderedTextBody,
            html: renderedHtmlBody,
          });
        } catch (err) {
          app.log.error("Failed to send confirmation email: %s", String(err));
        }
      }
    }

    // --- Fire webhook (async, fire-and-forget) ---
    // sendContactWebhook records the outcome on the ContactMessage so the
    // admin can see failures and retry them. We don't await — the form
    // response shouldn't block on a slow third-party endpoint.
    sendContactWebhook({
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
    }).catch((err) => {
      app.log.warn("Contact webhook helper crashed: %s", String(err));
    });

    return { success: true };
  });
}
