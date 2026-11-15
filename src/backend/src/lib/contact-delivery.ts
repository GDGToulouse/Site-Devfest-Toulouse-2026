import type { FastifyBaseLogger } from "fastify";
import { prisma } from "./prisma.js";
import { sendEmail, interpolate, interpolateHtml, escapeHtml } from "./email.js";
import { emailHeading } from "./email-template.js";
import { makeToken } from "./brochure-token.js";
import { sendContactWebhook } from "./contact-webhook.js";
import { notDeleted } from "./admin-helpers.js";
import { getFeaturedEdition } from "../routes/editions.js";

// Everything a stored contact message sends out: the mail to the organizers,
// the confirmation to the visitor, the webhook. Read back from the database so
// a message released from quarantine (#767) goes out exactly like one that was
// never held — same recipients, same brochure link, same payload.
//
// Returns false, sending nothing, for a message that is trashed or still in
// quarantine: this is the one place that guards the outbound path.
export async function deliverContactMessage(messageId: number, log: FastifyBaseLogger): Promise<boolean> {
  const stored = await prisma.contactMessage.findFirst({ where: { id: messageId, ...notDeleted } });
  if (!stored || stored.quarantinedAt) return false;

  // A message must not be routed to a category the organizers deleted — its
  // recipients would never see it (#147).
  const category = stored.categoryId
    ? await prisma.contactCategory.findFirst({ where: { id: stored.categoryId, ...notDeleted } })
    : null;
  const requiresCompanyInfo = category?.slug === "sponsor-brochure";

  let recipients: string[] = category ? category.emailRecipients.split(",").map((e: string) => e.trim()) : [];
  if (recipients.length === 0) {
    const defaultEmail = await prisma.siteSetting.findUnique({
      where: { key: "contact_default_email" },
    });
    recipients = [defaultEmail?.value || "contact@devfesttoulouse.fr"];
  }

  const { firstName, lastName, email, phone, company, jobTitle, categoryLabel, message, locale } = stored;

  // --- Notification email to the recipients ---
  try {
    const subject = `Nouveau message de contact — ${firstName} ${lastName}`;
    const text = [
      `De: ${firstName} ${lastName}`,
      `Email: ${email}`,
      phone ? `Téléphone: ${phone}` : null,
      company ? `Entreprise: ${company}` : null,
      jobTitle ? `Poste: ${jobTitle}` : null,
      categoryLabel ? `Catégorie: ${categoryLabel}` : null,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    // Everything below comes from a public form: escape it all before it
    // reaches an inbox as HTML.
    const html = `
        ${emailHeading("Nouveau message de contact")}
        <p><strong>De:</strong> ${escapeHtml(`${firstName} ${lastName}`)}</p>
        <p><strong>Email:</strong> <a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a></p>
        ${phone ? `<p><strong>Téléphone:</strong> ${escapeHtml(phone)}</p>` : ""}
        ${company ? `<p><strong>Entreprise:</strong> ${escapeHtml(company)}</p>` : ""}
        ${jobTitle ? `<p><strong>Poste:</strong> ${escapeHtml(jobTitle)}</p>` : ""}
        ${categoryLabel ? `<p><strong>Catégorie:</strong> ${escapeHtml(categoryLabel)}</p>` : ""}
        <hr style="border:0;border-top:1px solid #E8E0DC;margin:20px 0;">
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `;

    // Reply-To = the visitor, so the organizers can answer the message
    // directly without copy-pasting the address out of the body.
    await sendEmail({ to: recipients, subject, text, html, replyTo: email });
  } catch (err) {
    log.error("Failed to send contact email: %s", String(err));
  }

  // --- Confirmation email to the person who submitted the form ---
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
        // Untracked fallback only: the tracked link resolves the language
        // itself from the stored locale (#401), so it needs no variant here.
        const directBrochureUrl =
          (lang === "en" ? edition?.sponsorBrochureUrlEn : null) ??
          edition?.sponsorBrochureUrl ??
          edition?.sponsorBrochureUrlEn ??
          null;
        const brochureUrl = directBrochureUrl
          ? brochureToken
            ? `${baseUrl}/api/brochure/${brochureToken}`
            : `${baseUrl}${directBrochureUrl}`
          : "";

        const vars = { firstName, lastName, brochureUrl };

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

        // The body stays exactly as authored in the admin; the layout only
        // wraps it, in the requester's language.
        await sendEmail({
          to: [email],
          subject: renderedSubject,
          text: renderedTextBody,
          html: renderedHtmlBody,
          cc,
          locale: lang,
        });
      } catch (err) {
        log.error("Failed to send confirmation email: %s", String(err));
      }
    }
  }

  // --- Webhook (fire-and-forget) ---
  // sendContactWebhook records the outcome on the ContactMessage so the
  // admin can see failures and retry them. Not awaited — the form response
  // shouldn't block on a slow third-party endpoint.
  sendContactWebhook({
    id: stored.id,
    submittedAt: stored.createdAt.toISOString(),
    data: {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      categoryId: stored.categoryId,
      categorySlug: category?.slug || null,
      categoryLabel: categoryLabel || null,
      message,
      locale,
    },
  }).catch((err) => {
    log.warn("Contact webhook helper crashed: %s", String(err));
  });

  return true;
}
