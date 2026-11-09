import { AsyncLocalStorage } from "node:async_hooks";

import { prisma } from "./prisma.js";
import { sendEmail, escapeHtml } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";

const baseUrl = (process.env.BASE_URL || "http://localhost:4000").replace(/\/$/, "");

// better-auth's sendResetPassword callback. One callback serves two audiences,
// so the link depends on who asked (#411): a sponsor sent to /admin lands on a
// "DevFest Admin" page that then refuses its role.
//
// The role is read from the database rather than from `user`: better-auth only
// carries the fields it knows about, and #362 already lost the role that way.
export async function sendPasswordResetEmail({
  user,
  token,
}: {
  user: { id: string; email: string; name?: string | null };
  token: string;
}) {
  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const isSponsor = stored?.role === "SPONSOR";

  const resetUrl = `${baseUrl}/${isSponsor ? "sponsor" : "admin"}/reset-password?token=${token}`;

  const capture = capturedLink.getStore();
  if (capture && capture.userId === user.id) {
    capture.url = resetUrl;
    return;
  }
  const where = isSponsor ? "de votre espace partenaire DevFest Toulouse" : "du back-office DevFest Toulouse";

  await sendEmail({
    to: [user.email],
    subject: "DevFest Toulouse — Réinitialisation de mot de passe",
    text: `Bonjour ${user.name || ""},\n\nCliquez sur ce lien pour réinitialiser le mot de passe ${where} :\n${resetUrl}\n\nCe lien expire dans 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
    html: `
      ${emailHeading("Réinitialisation de mot de passe")}
      <p>Bonjour ${escapeHtml(user.name || "")},</p>
      <p>Cliquez sur le bouton ci-dessous pour réinitialiser le mot de passe ${where} :</p>
      ${emailButton(resetUrl, "Réinitialiser mon mot de passe")}
      <p>Ce lien expire dans 1 heure.</p>
      <p><em>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</em></p>
    `,
  });
}

// A reset link handed to the caller instead of mailed (#799): the admin sends
// it by hand to an invited team member whose email never arrived. Asked through
// better-auth's own reset endpoint, so the token is minted, stored and expires
// exactly as a mailed one; only the delivery changes. Scoped to one account, so
// a reset requested meanwhile for anyone else still goes out by email.
const capturedLink = new AsyncLocalStorage<{ userId: string; url?: string }>();

export async function captureResetLink(userId: string, request: () => Promise<unknown>): Promise<string | undefined> {
  const capture: { userId: string; url?: string } = { userId };
  await capturedLink.run(capture, request);
  return capture.url;
}
