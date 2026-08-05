import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
// Configuring any plugin makes better-auth's inferred type reach into zod's,
// which TypeScript must name in the emitted .d.ts (`declaration: true`). pnpm
// isolation put zod out of reach, so it is a direct dependency now — declared
// for its types, never imported (TS2742).
import { magicLink } from "better-auth/plugins";
import { prisma } from "./prisma.js";
import { sendEmail, escapeHtml } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";
import { hasPendingInvitation, normalizeEmail } from "./sponsor-invitation.js";
import { MAGIC_LINK_TTL_MINUTES, MAGIC_LINK_TTL_SECONDS } from "./edit-token.js";

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
  plugins: [
    // Sign in to an EXISTING account without a password (#362) — not a way to
    // create one: disableSignUp keeps the invitation the only door in, and
    // stops this endpoint from becoming an email-enumeration oracle that mints
    // accounts. Single-use and short-lived, unlike the 30-day edit link.
    magicLink({
      expiresIn: MAGIC_LINK_TTL_SECONDS,
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: [email],
          subject: "DevFest Toulouse — Votre lien de connexion",
          text: `Bonjour,\n\nCliquez sur ce lien pour vous connecter :\n${url}\n\nCe lien expire dans ${MAGIC_LINK_TTL_MINUTES} minutes et ne peut servir qu'une fois.\n\nSi vous n'avez pas demandé cette connexion, ignorez cet email.`,
          html: `
            ${emailHeading("Votre lien de connexion")}
            <p>Bonjour,</p>
            <p>Cliquez sur le bouton ci-dessous pour vous connecter à votre espace :</p>
            ${emailButton(url, "Me connecter")}
            <p>Ce lien expire dans ${MAGIC_LINK_TTL_MINUTES} minutes et ne peut servir qu'une fois.</p>
            <p><em>Si vous n'avez pas demandé cette connexion, ignorez cet email.</em></p>
          `,
        });
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Sign-up stays closed (#362): an account is created only for an
          // allow-listed admin, or for someone holding a live invitation to a
          // sponsor space.
          //
          // This check belongs here rather than after the fact: rejecting later
          // would leave an orphan User behind on every failed attempt — and for
          // OAuth, an account the organisers never invited.
          if (!user.email) {
            throw new APIError("FORBIDDEN", {
              message: "Inscription sur invitation uniquement. Contactez un administrateur.",
            });
          }
          if (isAdminEmail(user.email)) return;

          if (await hasPendingInvitation(user.email)) {
            // Sponsors get a role that grants nothing in the back-office. The
            // default is EDITOR, which requireAnyAuthenticated lets through —
            // leaving it would hand /api/admin/* to every sponsor.
            return { data: { ...user, role: "SPONSOR" } };
          }

          throw new APIError("FORBIDDEN", {
            message: "Inscription sur invitation uniquement. Contactez un administrateur.",
          });
        },
      },
    },
  },
});

// Normalized comparison: an admin typing "Prenom.Nom@gmail.com" into
// ADMIN_EMAILS must still match what Google reports in lowercase.
export function isAdminEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return ADMIN_EMAILS.some((e) => normalizeEmail(e) === normalized);
}
