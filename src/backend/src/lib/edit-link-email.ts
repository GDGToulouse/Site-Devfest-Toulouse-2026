import { sendEmail } from "./email.js";

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

// Sends the modification-link email (RG-243, RG-250). Throws on SMTP failure so
// the caller can surface an error and let the admin retry (RG-251).
export async function sendEditLinkEmail(opts: {
  to: string;
  name: string;
  token: string;
  kind: "speaker" | "sponsor";
}) {
  const url = `${baseUrl}/edit/${opts.token}`;
  const what = opts.kind === "speaker" ? "votre fiche speaker" : "votre fiche sponsor";

  await sendEmail({
    to: [opts.to],
    subject: "DevFest Toulouse — Lien de modification de votre fiche",
    text: `Bonjour ${opts.name},\n\nVoici votre lien personnel pour modifier ${what} sur le site du DevFest Toulouse :\n${url}\n\nCe lien est personnel, ne le partagez pas. Vous pouvez l'utiliser jusqu'à 48h avant l'événement.\n\nL'équipe DevFest Toulouse`,
    html: `
      <h3>Lien de modification de votre fiche</h3>
      <p>Bonjour ${opts.name},</p>
      <p>Voici votre lien personnel pour modifier ${what} sur le site du DevFest Toulouse :</p>
      <p><a href="${url}">Modifier ma fiche</a></p>
      <p>Ce lien est personnel, ne le partagez pas. Vous pouvez l'utiliser jusqu'à 48h avant l'événement.</p>
      <p><em>L'équipe DevFest Toulouse</em></p>
    `,
  });
}
