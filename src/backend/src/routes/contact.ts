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
  // Company + jobTitle are only required for sponsor-brochure requests;
  // the public /contact form leaves them out for everything else.
  company?: string;
  jobTitle?: string;
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
  // Hidden categories (isPublic=false) are still returned so dedicated
  // pages can match them by slug, but they're flagged so the generic
  // /contact <select> filters them out client-side.
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
      isPublic: cat.isPublic,
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
    const { firstName, lastName, email, phone, company, jobTitle, categoryId, message, locale, confirmUrl, website } = request.body;

    // Resolve the category upfront so the validator knows whether the
    // submission is a sponsor-brochure request (where company + jobTitle
    // are mandatory) or a generic contact (where both fields are optional).
    const category = categoryId
      ? await prisma.contactCategory.findUnique({ where: { id: categoryId } })
      : null;
    const requiresCompanyInfo = category?.slug === "sponsor-brochure";

    // Server-side validation first, so we can tell "honeypot + bot-like
    // payload" (drop silently) apart from "honeypot + real user with
    // aggressive autofill" (show a helpful error). A real bot rarely
    // fills all four required fields cleanly before triggering the trap;
    // a human whose password-manager polluted the hidden input does.
    const errors: Record<string, string> = {};
    if (!firstName?.trim()) errors.firstName = "required";
    if (!lastName?.trim()) errors.lastName = "required";
    if (!email?.trim() || !validateEmail(email)) errors.email = "invalid";
    if (requiresCompanyInfo && !company?.trim()) errors.company = "required";
    if (requiresCompanyInfo && !jobTitle?.trim()) errors.jobTitle = "required";
    if (!message?.trim() || message.trim().length < 10) errors.message = "too_short";

    const honeypotValue = confirmUrl || website;
    if (honeypotValue) {
      if (Object.keys(errors).length === 0) {
        // All required fields are valid AND the honeypot was touched —
        // this looks like autofill on a legitimate user. Tell them so
        // they know their message didn't vanish.
        request.log.warn(
          { ip: request.ip, email, honeypotValue: honeypotValue.slice(0, 80) },
          "[contact] honeypot tripped on well-formed payload — surfacing error to user",
        );
        return reply.status(400).send({
          success: false,
          errors: { honeypot: "autofill_detected" },
        });
      }
      // Missing/bad required fields + honeypot => classic bot. Drop silently.
      request.log.warn(
        { ip: request.ip, email, honeypotValue: honeypotValue.slice(0, 80) },
        "[contact] honeypot tripped on bot-like payload — silently dropped",
      );
      return { success: true };
    }

    if (Object.keys(errors).length > 0) {
      return reply.status(400).send({ success: false, errors });
    }

    // Resolve recipients from the category we already fetched above.
    let recipients: string[] = [];
    let categoryLabel: string | null = null;
    if (category) {
      recipients = category.emailRecipients.split(",").map((e: string) => e.trim());
      categoryLabel = category.nameFr;
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
        company: company?.trim() || "",
        jobTitle: jobTitle?.trim() || "",
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
        company?.trim() ? `Entreprise: ${company.trim()}` : null,
        jobTitle?.trim() ? `Poste: ${jobTitle.trim()}` : null,
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
        ${company?.trim() ? `<p><strong>Entreprise:</strong> ${company.trim()}</p>` : ""}
        ${jobTitle?.trim() ? `<p><strong>Poste:</strong> ${jobTitle.trim()}</p>` : ""}
        ${categoryLabel ? `<p><strong>Catégorie:</strong> ${categoryLabel}</p>` : ""}
        <hr>
        <p>${message.trim().replace(/\n/g, "<br>")}</p>
      `;

      // Reply-To = the visitor, so the organizers can answer the message
      // directly without copy-pasting the address out of the body.
      await sendEmail({ to: recipients, subject, text, html, replyTo: email.trim() });
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

          // Keep the organizers (the category recipients) in CC of the
          // brochure confirmation so they see exactly what the requester got,
          // with the tracked brochure link. Brochure requests only.
          const cc = requiresCompanyInfo && recipients.length > 0 ? recipients : undefined;

          await sendEmail({
            to: [email.trim()],
            subject: renderedSubject,
            text: renderedTextBody,
            html: renderedHtmlBody,
            cc,
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
        company: company?.trim() || "",
        jobTitle: jobTitle?.trim() || "",
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
