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

function frenchTemplate(name: string, what: string, url: string): Template {
  return {
    subject: "DevFest Toulouse — Lien de modification de votre fiche",
    text: `Bonjour ${name},\n\nVoici votre lien personnel pour modifier ${what} sur le site du DevFest Toulouse :\n${url}\n\nCe lien est personnel, ne le partagez pas. Il est valable ${EDIT_TOKEN_TTL_DAYS} jours, et les modifications sont clôturées 48h avant l'événement.\n\nL'équipe DevFest Toulouse`,
    html: `
      ${emailHeading("Lien de modification de votre fiche")}
      <p>Bonjour ${escapeHtml(name)},</p>
      <p>Voici votre lien personnel pour modifier ${what} sur le site du DevFest Toulouse :</p>
      ${emailButton(url, "Modifier ma fiche")}
      <p>Ce lien est personnel, ne le partagez pas. Il est valable ${EDIT_TOKEN_TTL_DAYS} jours, et les modifications sont clôturées 48h avant l'événement.</p>
      <p><em>L'équipe DevFest Toulouse</em></p>
    `,
  };
}

function englishTemplate(name: string, what: string, url: string): Template {
  return {
    subject: "DevFest Toulouse — Link to edit your profile",
    text: `Hello ${name},\n\nHere is your personal link to update ${what} on the DevFest Toulouse website:\n${url}\n\nThis link is personal, please do not share it. It is valid for ${EDIT_TOKEN_TTL_DAYS} days, and editing closes 48 hours before the event.\n\nThe DevFest Toulouse team`,
    html: `
      ${emailHeading("Link to edit your profile")}
      <p>Hello ${escapeHtml(name)},</p>
      <p>Here is your personal link to update ${what} on the DevFest Toulouse website:</p>
      ${emailButton(url, "Edit my profile")}
      <p>This link is personal, please do not share it. It is valid for ${EDIT_TOKEN_TTL_DAYS} days, and editing closes 48 hours before the event.</p>
      <p><em>The DevFest Toulouse team</em></p>
    `,
  };
}

// Sends the modification-link email (RG-243, RG-250). Throws on SMTP failure so
// the caller can surface an error and let the admin retry (RG-251).
// Written in the recipient's own language (#224) — an English-speaking speaker
// used to get a French email they could not read.
//
// Speakers only since #362: a sponsor gets an account invitation instead, so
// the sponsor wording and the logo guidance that went with it are gone.
export async function sendEditLinkEmail(opts: {
  to: string;
  name: string;
  token: string;
  locale?: string | null;
}) {
  const url = `${baseUrl}/edit/${opts.token}`;
  const lang = normalizeLocale(opts.locale);

  const what = lang === "en" ? "your speaker profile" : "votre fiche speaker";

  const tpl = lang === "en"
    ? englishTemplate(opts.name, what, url)
    : frenchTemplate(opts.name, what, url);

  await sendEmail({
    to: [opts.to],
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    locale: lang,
  });
}

interface InvitationCopy {
  subject: string;
  preview: string;
  heading: string;
  intro: (sponsor: string) => string;
  canDoTitle: string;
  canDo: string[];
  live: string;
  cta: string;
  ctaLead: string;
  exactAddress: (to: string) => string;
  validity: string;
  comeBack: string;
  help: string;
  signature: string;
}

// One list shared by every role (#505): the mail goes out from three places —
// admin invite, admin resend, a RESPONSABLE inviting a colleague — and must
// stay true in all of them. What a STAND contact can do is a subset of it.
const INVITATION_COPY: Record<ContactLocale, InvitationCopy> = {
  fr: {
    subject: "sur le site du DevFest Toulouse — mettez à jour votre fiche",
    preview: "Créez votre accès à l'espace partenaire : fiche publique, offres d'emploi, équipe et kit de communication.",
    heading: "Votre espace partenaire DevFest Toulouse",
    intro: (s) =>
      // "de l'entreprise X", not "de X": a name starting with a vowel would
      // need "d'", which a variable name cannot get right.
      `Vous êtes invité·e à rejoindre l'espace partenaire de l'entreprise ${s} sur le site du DevFest Toulouse. C'est là que vous tenez à jour ce que le site affiche de votre entreprise.`,
    canDoTitle: "Depuis l'espace partenaire, vous pouvez :",
    canDo: [
      "mettre à jour votre fiche publique : logo, description en français et en anglais, site web, réseaux sociaux ;",
      "publier vos offres d'emploi, affichées sur la page « Offres d'emploi » du site ;",
      "nous transmettre votre kit de communication : logos web et impression, charte graphique ;",
      "inviter vos collègues, dont l'équipe présente sur votre stand.",
    ],
    live: "Vos modifications sont en ligne dès l'enregistrement.",
    ctaLead: "Créez votre compte ici :",
    cta: "Créer mon compte",
    exactAddress: (to) => `Utilisez exactement cette adresse e-mail (${to}) : l'invitation ne fonctionne qu'avec elle.`,
    validity: `Cette invitation est valable ${INVITATION_TTL_DAYS} jours et ne sert qu'une fois.`,
    comeBack: "Une fois votre compte créé, retrouvez votre espace à tout moment sur :",
    help: "En cas de problème (lien expiré, mauvaise adresse, accès à donner à quelqu'un d'autre), répondez simplement à cet e-mail.",
    signature: "L'équipe DevFest Toulouse",
  },
  en: {
    subject: "on the DevFest Toulouse website — update your listing",
    preview: "Create your access to the partner space: public listing, job offers, team and communication kit.",
    heading: "Your DevFest Toulouse partner space",
    intro: (s) =>
      `You are invited to join ${s}'s partner space on the DevFest Toulouse website. This is where you keep what the website shows about your company up to date.`,
    canDoTitle: "From the partner space, you can:",
    canDo: [
      "update your public listing: logo, description in French and English, website, social networks;",
      "publish your job offers, shown on the website's \"Job offers\" page;",
      "send us your communication kit: web and print logos, brand guidelines;",
      "invite your colleagues, including the team on your booth.",
    ],
    live: "Your changes go live as soon as you save them.",
    ctaLead: "Create your account here:",
    cta: "Create my account",
    exactAddress: (to) => `Use this exact email address (${to}): the invitation only works with it.`,
    validity: `This invitation is valid for ${INVITATION_TTL_DAYS} days and can be used once.`,
    comeBack: "Once your account is created, find your space at any time at:",
    help: "If anything goes wrong (expired link, wrong address, access for someone else), simply reply to this email.",
    signature: "The DevFest Toulouse team",
  },
};

// Invitation to create an account on a sponsor's space (#362). Distinct from
// the mail above: that one hands out an edit link that works on its own, this
// one opens an account the person will come back to. Throws on SMTP failure so
// the caller can avoid persisting an invitation nobody received.
//
// It explains what the space is for and how to get back to it (#505): the
// first version only said "you have been invited", and the team had to chase
// sponsors by hand. It asks for replies, so SMTP_FROM must be a read mailbox.
export async function sendSponsorInvitationEmail(opts: {
  to: string;
  sponsorName: string;
  token: string;
  locale?: string | null;
}) {
  const url = `${baseUrl}/sponsor/invitation/${opts.token}`;
  const spaceUrl = `${baseUrl}/sponsor`;
  const lang = normalizeLocale(opts.locale);
  const c = INVITATION_COPY[lang];
  const name = escapeHtml(opts.sponsorName);

  // The address is named in the body on purpose: the account must be created
  // with this exact address, and saying so up front avoids a failed sign-in
  // with a personal account (#362).
  const text = [
    lang === "en" ? "Hello," : "Bonjour,",
    c.intro(opts.sponsorName),
    [c.canDoTitle, ...c.canDo.map((item) => `- ${item}`), c.live].join("\n"),
    `${c.ctaLead}\n${url}`,
    `${c.exactAddress(opts.to)} ${c.validity}`,
    `${c.comeBack}\n${spaceUrl}`,
    c.help,
    c.signature,
  ].join("\n\n");

  // The copy above is our own constant text; only the sponsor name and the
  // address come from the database, and only they are escaped.
  const html = `
    ${emailHeading(c.heading)}
    <p>${lang === "en" ? "Hello," : "Bonjour,"}</p>
    <p>${c.intro(`<strong>${name}</strong>`)}</p>
    <p>${c.canDoTitle}</p>
    <ul>${c.canDo.map((item) => `<li>${item}</li>`).join("")}</ul>
    <p>${c.live}</p>
    ${emailButton(url, c.cta)}
    <p>${c.exactAddress(`<strong>${escapeHtml(opts.to)}</strong>`)} ${c.validity}</p>
    <p>${c.comeBack} <a href="${spaceUrl}">${spaceUrl}</a></p>
    <p>${c.help}</p>
    <p><em>${c.signature}</em></p>
  `;

  await sendEmail({
    to: [opts.to],
    subject: `${opts.sponsorName} ${c.subject}`,
    previewText: c.preview,
    text,
    html,
    locale: lang,
    acceptsReplies: true,
  });
}
