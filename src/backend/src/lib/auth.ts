import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { prisma } from "./prisma.js";
import { sendEmail, escapeHtml } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

// Build a wildcard origin from the public base URL so we don't have to list
// each environment subdomain (dev-j, beta, prod). Returns null for non-FQDN
// hostnames (e.g. localhost) to avoid accidental wildcards in local dev.
function buildWildcardOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.hostname.split(".");
    if (parts.length >= 2 && !/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      return `${parsed.protocol}//*.${parts.slice(-2).join(".")}`;
    }
    return null;
  } catch {
    return null;
  }
}

const baseUrl = normalizeUrl(process.env.BASE_URL || "http://localhost:4000");
const frontendUrl = normalizeUrl(process.env.FRONTEND_URL || "http://localhost:3000");
const wildcardOrigin = buildWildcardOrigin(baseUrl);
const trustedOrigins = [baseUrl, frontendUrl, ...(wildcardOrigin ? [wildcardOrigin] : [])].filter(
  (v, i, arr) => arr.indexOf(v) === i,
);

export const auth = betterAuth({
  // Reuse SESSION_SECRET so we keep a single secret to manage. Better Auth
  // otherwise reads BETTER_AUTH_SECRET and, in production, throws at startup
  // when it falls back to its built-in default secret.
  secret: process.env.SESSION_SECRET || process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: baseUrl,
  basePath: "/api/auth",
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, token }) => {
      // Build the reset URL manually pointing to the frontend page (not the
      // Better Auth callback endpoint, which is an API route and not
      // navigable). baseUrl is the public BASE_URL injected by Coolify or
      // overridden locally.
      const resetUrl = `${baseUrl}/admin/reset-password?token=${token}`;
      await sendEmail({
        to: [user.email],
        subject: "DevFest Toulouse — Réinitialisation de mot de passe",
        text: `Bonjour ${user.name || ""},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe :\n${resetUrl}\n\nCe lien expire dans 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
        html: `
          ${emailHeading("Réinitialisation de mot de passe")}
          <p>Bonjour ${escapeHtml(user.name || "")},</p>
          <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
          ${emailButton(resetUrl, "Réinitialiser mon mot de passe")}
          <p>Ce lien expire dans 1 heure.</p>
          <p><em>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</em></p>
        `,
      });
    },
  },
  socialProviders: {
    // Implicit sign-up stays enabled so an allow-listed admin can sign in via
    // OAuth on their very first visit (no prior email/password account needed).
    // Access is still gated: the databaseHooks.user.create.before hook below
    // rejects any email that is not in ADMIN_EMAILS.
    google: {
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || "",
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
