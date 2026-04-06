import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { prisma } from "./prisma.js";
import { sendEmail } from "./email.js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BASE_URL || "http://localhost:4000",
  basePath: "/api/auth",
  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: [user.email],
        subject: "DevFest Toulouse — Réinitialisation de mot de passe",
        text: `Bonjour ${user.name || ""},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe :\n${url}\n\nCe lien expire dans 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
        html: `
          <h3>Réinitialisation de mot de passe</h3>
          <p>Bonjour ${user.name || ""},</p>
          <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
          <p><a href="${url}">Réinitialiser mon mot de passe</a></p>
          <p>Ce lien expire dans 1 heure.</p>
          <p><em>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</em></p>
        `,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || "",
      disableImplicitSignUp: true,
    },
    github: {
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || "",
      disableImplicitSignUp: true,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["email-password", "google", "github"],
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Only allow account creation if the email is in ADMIN_EMAILS
          if (!user.email || !isAdminEmail(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Inscription sur invitation uniquement. Contactez un administrateur.",
            });
          }
        },
      },
    },
  },
});

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}
