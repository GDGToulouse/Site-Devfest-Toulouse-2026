import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendEmail, interpolate, interpolateHtml, escapeHtml } from "../lib/email.js";
import { emailHeading } from "../lib/email-template.js";
import { makeToken } from "../lib/brochure-token.js";
import { sendContactWebhook } from "../lib/contact-webhook.js";
import { getFeaturedEdition } from "./editions.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { brochureIpRetryAfter, claimAddress, consumeBrochureIpBudget, hasRecentBrochureRequest } from "../lib/brochure-limits.js";

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

// The domain's labels cannot hold a dot, so each dot has one place to match:
// the check stays linear in the address's length.
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

// The form is public and anonymous: bound every field before the handler, so a
// malformed body is refused cheaply and never reaches the mailer. The ceilings
// sit well above anything a person types; 254 is the longest valid address.
// The optional fields take null as well as absence: JSON.stringify turns a
// category id that is not a number into null.
const contactBodySchema = {
  type: "object",
  properties: {
    firstName: { type: "string", maxLength: 100 },
    lastName: { type: "string", maxLength: 100 },
    email: { type: "string", maxLength: 254 },
    phone: { type: ["string", "null"], maxLength: 40 },
    company: { type: ["string", "null"], maxLength: 200 },
    jobTitle: { type: ["string", "null"], maxLength: 200 },
    categoryId: { type: ["integer", "null"], minimum: 1 },
    message: { type: "string", maxLength: 10_000 },
    locale: { type: ["string", "null"], maxLength: 10 },
    confirmUrl: { type: ["string", "null"], maxLength: 2048 },
    website: { type: ["string", "null"], maxLength: 2048 },
  },
} as const;

export default async function contactRoutes(app: FastifyInstance) {
  // GET /api/contact/categories — public list of active categories
  // Hidden categories (isPublic=false) are still returned so dedicated
  // pages can match them by slug, but they're flagged so the generic
  // /contact <select> filters them out client-side.
  app.get("/contact/categories", async () => {
    const categories = await prisma.contactCategory.findMany({
      where: { isActive: true, ...notDeleted },
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
  // Rate limit: 5 messages per 15 minutes per IP. Brochure requests also have
  // their own caps (#662): 3 per hour per IP, 1 mail per hour per address.
  app.post<{ Body: ContactBody }>("/contact/send", {
    schema: { body: contactBodySchema },
    // Every field at its ceiling stays under 16 KiB.
    bodyLimit: 32 * 1024,
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
    // findFirst so the trash filter fits (#147): a message must not be routed
    // to a category the organizers deleted — its recipients would never see it.
    const category = categoryId
      ? await prisma.contactCategory.findFirst({ where: { id: categoryId, ...notDeleted } })
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

    // The brochure confirmation goes to an address nobody proved theirs (#662).
    // Per IP first: past three requests an hour the answer is a plain refusal.
    if (requiresCompanyInfo && !consumeBrochureIpBudget(request.ip)) {
      request.log.warn({ ip: request.ip, email }, "[contact] brochure requests per IP exceeded");
      return reply
        .status(429)
        .header("retry-after", String(brochureIpRetryAfter(request.ip)))
        .send({ success: false, error: "Too Many Requests", message: "Too many brochure requests, try again later" });
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

    // Store message in DB. A brochure request for an address that had one in the
    // last hour is answered like a success, so the form reveals nothing, but
    // stores and sends nothing (#662).
    const release = requiresCompanyInfo ? claimAddress(email) : null;
    if (requiresCompanyInfo && !release) {
      request.log.warn({ ip: request.ip, email }, "[contact] brochure request already in progress for this address — ignored");
      return { success: true };
    }
    let stored;
    try {
      if (requiresCompanyInfo && category && (await hasRecentBrochureRequest(category.id, email))) {
        request.log.warn({ ip: request.ip, email }, "[contact] brochure already sent to this address within the hour — ignored");
        return { success: true };
      }
      stored = await prisma.contactMessage.create({
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
    } finally {
      release?.();
    }

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

      // Everything below comes from a public form: escape it all before it
      // reaches an inbox as HTML.
      const html = `
        ${emailHeading("Nouveau message de contact")}
        <p><strong>De:</strong> ${escapeHtml(`${firstName.trim()} ${lastName.trim()}`)}</p>
        <p><strong>Email:</strong> <a href="mailto:${encodeURIComponent(email.trim())}">${escapeHtml(email.trim())}</a></p>
        ${phone ? `<p><strong>Téléphone:</strong> ${escapeHtml(phone.trim())}</p>` : ""}
        ${company?.trim() ? `<p><strong>Entreprise:</strong> ${escapeHtml(company.trim())}</p>` : ""}
        ${jobTitle?.trim() ? `<p><strong>Poste:</strong> ${escapeHtml(jobTitle.trim())}</p>` : ""}
        ${categoryLabel ? `<p><strong>Catégorie:</strong> ${escapeHtml(categoryLabel)}</p>` : ""}
        <hr style="border:0;border-top:1px solid #E8E0DC;margin:20px 0;">
        <p>${escapeHtml(message.trim()).replace(/\n/g, "<br>")}</p>
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

          // The body stays exactly as authored in the admin; the layout only
          // wraps it, in the requester's language.
          await sendEmail({
            to: [email.trim()],
            subject: renderedSubject,
            text: renderedTextBody,
            html: renderedHtmlBody,
            cc,
            locale: lang,
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
