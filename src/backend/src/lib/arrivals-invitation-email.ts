import { sendEmail, escapeHtml } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";
import { INVITATION_TTL_DAYS } from "./edit-token.js";

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

// Invitation to the event-day screens of an edition (#640). French only: the
// volunteers are the local team. Throws on SMTP failure so the caller can avoid
// persisting an invitation nobody received (#223).
export async function sendArrivalsInvitationEmail(opts: { to: string; editionYear: number; token: string }) {
  const url = `${baseUrl}/arrivees/invitation/${opts.token}`;
  const zoneUrl = `${baseUrl}/arrivees`;
  const intro = `Vous êtes invité·e à l'accueil des participants du DevFest Toulouse ${opts.editionYear}, en tant que bénévole.`;
  const purpose =
    "Ce compte vous ouvre les écrans de l'accueil le jour J : scan des billets, préparation et remise des badges, guichet d'aide. Il ne donne accès à rien d'autre.";
  const exactAddress = (to: string) =>
    `Créez votre compte avec exactement cette adresse e-mail (${to}) : l'invitation ne fonctionne qu'avec elle.`;
  const validity = `Cette invitation est valable ${INVITATION_TTL_DAYS} jours et ne sert qu'une fois. Passé ce délai, demandez-en une nouvelle à l'équipe.`;

  await sendEmail({
    to: [opts.to],
    subject: `DevFest Toulouse ${opts.editionYear} — votre accès à l'accueil des participants`,
    previewText: "Créez votre compte de bénévole pour l'accueil du jour J.",
    text: [
      "Bonjour,",
      intro,
      purpose,
      `Créez votre compte ici :\n${url}`,
      `${exactAddress(opts.to)} ${validity}`,
      `Le jour J, retrouvez l'accueil sur :\n${zoneUrl}`,
      "L'équipe DevFest Toulouse",
    ].join("\n\n"),
    html: `
      ${emailHeading("Votre accès à l'accueil des participants")}
      <p>Bonjour,</p>
      <p>${intro}</p>
      <p>${purpose}</p>
      ${emailButton(url, "Créer mon compte")}
      <p>${exactAddress(`<strong>${escapeHtml(opts.to)}</strong>`)} ${validity}</p>
      <p>Le jour J, retrouvez l'accueil sur <a href="${zoneUrl}">${zoneUrl}</a>.</p>
      <p><em>L'équipe DevFest Toulouse</em></p>
    `,
    acceptsReplies: true,
  });
}
