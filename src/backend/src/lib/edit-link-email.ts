import { sendEmail, escapeHtml } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";
import { EDIT_TOKEN_TTL_DAYS, INVITATION_TTL_DAYS } from "./edit-token.js";

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

// Invitation to create an account on a sponsor's space (#362). Distinct from
// the mail above: that one hands out an edit link that works on its own, this
// one opens an account the person will come back to. Throws on SMTP failure so
// the caller can avoid persisting an invitation nobody received.
export async function sendSponsorInvitationEmail(opts: {
  to: string;
  sponsorName: string;
  token: string;
  locale?: string | null;
}) {
  const url = `${baseUrl}/sponsor/invitation/${opts.token}`;
  const lang = normalizeLocale(opts.locale);

  // The address is named in the body on purpose: the account must be created
  // with this exact address, and saying so up front avoids a failed sign-in
  // with a personal account (#362).
  const tpl: Template =
    lang === "en"
      ? {
          subject: `DevFest Toulouse — Your access to ${opts.sponsorName}'s space`,
          text: `Hello,\n\nYou have been invited to manage ${opts.sponsorName}'s profile on the DevFest Toulouse website.\n\nCreate your account here:\n${url}\n\nUse this exact email address (${opts.to}) — the invitation only works with it.\n\nThis invitation is valid for ${INVITATION_TTL_DAYS} days and can be used once.\n\nThe DevFest Toulouse team`,
          html: `
            ${emailHeading(`Your access to ${escapeHtml(opts.sponsorName)}'s space`)}
            <p>Hello,</p>
            <p>You have been invited to manage <strong>${escapeHtml(opts.sponsorName)}</strong>'s profile on the DevFest Toulouse website.</p>
            ${emailButton(url, "Create my account")}
            <p>Use this exact email address (<strong>${escapeHtml(opts.to)}</strong>) — the invitation only works with it.</p>
            <p>This invitation is valid for ${INVITATION_TTL_DAYS} days and can be used once.</p>
            <p><em>The DevFest Toulouse team</em></p>
          `,
        }
      : {
          subject: `DevFest Toulouse — Votre accès à l'espace ${opts.sponsorName}`,
          text: `Bonjour,\n\nVous avez été invité à gérer la fiche de ${opts.sponsorName} sur le site du DevFest Toulouse.\n\nCréez votre compte ici :\n${url}\n\nUtilisez exactement cette adresse email (${opts.to}) — l'invitation ne fonctionne qu'avec elle.\n\nCette invitation est valable ${INVITATION_TTL_DAYS} jours et ne peut servir qu'une fois.\n\nL'équipe DevFest Toulouse`,
          html: `
            ${emailHeading(`Votre accès à l'espace ${escapeHtml(opts.sponsorName)}`)}
            <p>Bonjour,</p>
            <p>Vous avez été invité à gérer la fiche de <strong>${escapeHtml(opts.sponsorName)}</strong> sur le site du DevFest Toulouse.</p>
            ${emailButton(url, "Créer mon compte")}
            <p>Utilisez exactement cette adresse email (<strong>${escapeHtml(opts.to)}</strong>) — l'invitation ne fonctionne qu'avec elle.</p>
            <p>Cette invitation est valable ${INVITATION_TTL_DAYS} jours et ne peut servir qu'une fois.</p>
            <p><em>L'équipe DevFest Toulouse</em></p>
          `,
        };

  await sendEmail({ to: [opts.to], subject: tpl.subject, text: tpl.text, html: tpl.html, locale: lang });
}
