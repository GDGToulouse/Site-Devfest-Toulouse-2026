import { sendEmail, escapeHtml } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";
import { EDIT_TOKEN_TTL_DAYS } from "./edit-token.js";

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

export type ContactLocale = "fr" | "en";

// Anything that is not English falls back to French — the site's default
// language, and what every row carried before #224. Case-insensitive: an "EN"
// coming from an import or a hand-written API call should not silently send
// French mail to an English speaker.
export function normalizeLocale(value: string | null | undefined): ContactLocale {
  return value?.trim().toLowerCase() === "en" ? "en" : "fr";
}

interface Template {
  subject: string;
  text: string;
  html: string;
}

// Logo requirements, sent to sponsors only (#340): a low-resolution or
// margin-padded logo renders badly once the higher tiers scale it up (#315),
// and organisers currently chase sponsors by hand to get a usable file.
const LOGO_GUIDANCE = {
  fr: "Pour le logo : haute définition (largeur ≥ 1000 px), sans marge autour du logo, et de préférence PNG ou WebP à fond transparent.",
  en: "About the logo: high resolution (width ≥ 1000 px), with no built-in margin, and preferably PNG or WebP with a transparent background.",
} as const;

function frenchTemplate(name: string, what: string, url: string, logoGuidance?: string): Template {
  return {
    subject: "DevFest Toulouse — Lien de modification de votre fiche",
    text: `Bonjour ${name},\n\nVoici votre lien personnel pour modifier ${what} sur le site du DevFest Toulouse :\n${url}\n${logoGuidance ? `\n${logoGuidance}\n` : ""}\nCe lien est personnel, ne le partagez pas. Il est valable ${EDIT_TOKEN_TTL_DAYS} jours, et les modifications sont clôturées 48h avant l'événement.\n\nL'équipe DevFest Toulouse`,
    html: `
      ${emailHeading("Lien de modification de votre fiche")}
      <p>Bonjour ${escapeHtml(name)},</p>
      <p>Voici votre lien personnel pour modifier ${what} sur le site du DevFest Toulouse :</p>
      ${emailButton(url, "Modifier ma fiche")}
      ${logoGuidance ? `<p>${escapeHtml(logoGuidance)}</p>` : ""}
      <p>Ce lien est personnel, ne le partagez pas. Il est valable ${EDIT_TOKEN_TTL_DAYS} jours, et les modifications sont clôturées 48h avant l'événement.</p>
      <p><em>L'équipe DevFest Toulouse</em></p>
    `,
  };
}

function englishTemplate(name: string, what: string, url: string, logoGuidance?: string): Template {
  return {
    subject: "DevFest Toulouse — Link to edit your profile",
    text: `Hello ${name},\n\nHere is your personal link to update ${what} on the DevFest Toulouse website:\n${url}\n${logoGuidance ? `\n${logoGuidance}\n` : ""}\nThis link is personal, please do not share it. It is valid for ${EDIT_TOKEN_TTL_DAYS} days, and editing closes 48 hours before the event.\n\nThe DevFest Toulouse team`,
    html: `
      ${emailHeading("Link to edit your profile")}
      <p>Hello ${escapeHtml(name)},</p>
      <p>Here is your personal link to update ${what} on the DevFest Toulouse website:</p>
      ${emailButton(url, "Edit my profile")}
      ${logoGuidance ? `<p>${escapeHtml(logoGuidance)}</p>` : ""}
      <p>This link is personal, please do not share it. It is valid for ${EDIT_TOKEN_TTL_DAYS} days, and editing closes 48 hours before the event.</p>
      <p><em>The DevFest Toulouse team</em></p>
    `,
  };
}

// Sends the modification-link email (RG-243, RG-250). Throws on SMTP failure so
// the caller can surface an error and let the admin retry (RG-251).
// Written in the recipient's own language (#224) — an English-speaking speaker
// used to get a French email they could not read.
export async function sendEditLinkEmail(opts: {
  to: string;
  name: string;
  token: string;
  kind: "speaker" | "sponsor";
  locale?: string | null;
}) {
  const url = `${baseUrl}/edit/${opts.token}`;
  const lang = normalizeLocale(opts.locale);

  const what =
    lang === "en"
      ? opts.kind === "speaker"
        ? "your speaker profile"
        : "your sponsor profile"
      : opts.kind === "speaker"
        ? "votre fiche speaker"
        : "votre fiche sponsor";

  // A speaker uploads a photo, not a logo — the guidance would be noise there.
  const logoGuidance = opts.kind === "sponsor" ? LOGO_GUIDANCE[lang] : undefined;

  const tpl = lang === "en"
    ? englishTemplate(opts.name, what, url, logoGuidance)
    : frenchTemplate(opts.name, what, url, logoGuidance);

  await sendEmail({
    to: [opts.to],
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    locale: lang,
  });
}
