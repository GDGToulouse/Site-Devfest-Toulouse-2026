// Shared HTML layout for every outgoing email (#269).
//
// Email clients are stuck in 2005: no <style> support in Gmail, no flexbox in
// Outlook, no external CSS anywhere. So this is table-based with inline styles
// only — verbose on purpose. Colours come from the design system tokens in
// src/frontend/src/app/globals.css.

const COLORS = {
  malachite: "#0B7350",
  terreCuite: "#C24A1F",
  noir: "#1D1D1B",
  gris: "#737372",
  blanc: "#FFFFFF",
  blancCasse: "#FDF0EB",
} as const;

const SITE_NAME = "DevFest Toulouse";

type Locale = "fr" | "en";

function baseUrl(): string {
  return (process.env.BASE_URL || "https://devfesttoulouse.fr").replace(/\/$/, "");
}

// PNG, not SVG: Gmail and Outlook don't render SVG. EMAIL_LOGO_URL overrides it
// when the logo must be hosted elsewhere (e.g. a CDN reachable from mailboxes).
function logoUrl(): string {
  return process.env.EMAIL_LOGO_URL || `${baseUrl()}/images/logo-devfest-96.png`;
}

const FOOTER = {
  fr: {
    tagline: "La conférence Toulousaine par les devs et pour les devs.",
    site: "devfesttoulouse.fr",
    automated: "Cet email vous a été envoyé automatiquement, merci de ne pas y répondre directement.",
  },
  en: {
    tagline: "The Toulouse conference by developers, for developers.",
    site: "devfesttoulouse.fr",
    automated: "This email was sent automatically — please do not reply to it directly.",
  },
} as const;

/**
 * Wraps an email body in the DevFest layout: logo header on the brand green,
 * white content card, footer. `bodyHtml` is inserted as-is — callers are
 * responsible for escaping any user-controlled value (see escapeHtml /
 * interpolateHtml in email.ts).
 *
 * `previewText` is the snippet inboxes show next to the subject; keep it short
 * and meaningful, it is hidden in the rendered email.
 */
export function renderEmail({
  locale = "fr",
  previewText = "",
  bodyHtml,
}: {
  locale?: Locale;
  previewText?: string;
  bodyHtml: string;
}): string {
  const t = FOOTER[locale] ?? FOOTER.fr;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SITE_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.blancCasse};">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLORS.blancCasse};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="background-color:${COLORS.malachite};border-radius:12px 12px 0 0;padding:24px;">
            <img src="${logoUrl()}" alt="${SITE_NAME}" width="64" height="64" style="display:block;border:0;width:64px;height:auto;">
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:${COLORS.blanc};padding:32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${COLORS.noir};">
${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${COLORS.blanc};border-radius:0 0 12px 12px;border-top:1px solid #E8E0DC;padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${COLORS.gris};">
            <p style="margin:0 0 6px;">${t.tagline}</p>
            <p style="margin:0 0 6px;">
              <a href="${baseUrl()}" style="color:${COLORS.malachite};text-decoration:none;">${t.site}</a>
            </p>
            <p style="margin:0;color:#9A9A99;font-size:12px;">${t.automated}</p>
            <p style="margin:8px 0 0;color:#9A9A99;font-size:12px;">© ${year} ${SITE_NAME} — GDG Toulouse</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * A call-to-action button. Uses a table so Outlook renders the background:
 * a styled <a> alone collapses there.
 */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="background-color:${COLORS.malachite};border-radius:12px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:${COLORS.blanc};text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}

/** Section heading inside an email body, in the brand green. */
export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:${COLORS.malachite};">${text}</h1>`;
}

export const EMAIL_COLORS = COLORS;
