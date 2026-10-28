import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
// Configuring any plugin makes better-auth's inferred type reach into zod's,
// which TypeScript must name in the emitted .d.ts (`declaration: true`). pnpm
// isolation put zod out of reach, so it is a direct dependency now — declared
// for its types, never imported (TS2742). @better-auth/oauth-provider, which
// mcp() returns, is direct for the same reason.
import { jwt, magicLink } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { prisma } from "./prisma.js";
import { sendEmail } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";
import { sendPasswordResetEmail } from "./password-reset-email.js";
import { hasPendingInvitation, isTokenProvenSignUp, normalizeEmail } from "./sponsor-invitation.js";
import { hasPendingArrivalsInvitation } from "./arrivals-access.js";
import { trustedOriginsFor } from "./trusted-origins.js";
import { MAGIC_LINK_TTL_MINUTES, MAGIC_LINK_TTL_SECONDS } from "./edit-token.js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

// An absolute URL, or the local default. Vite injects BASE_URL="/" (its own base
// path) under Vitest, and mcp() refuses anything but an absolute resource URL —
// at import time, which would take every test that loads auth down with it.
function absoluteUrlOr(value: string | undefined, fallback: string): string {
  return value && /^https?:\/\//.test(value) ? value : fallback;
}

const baseUrl = normalizeUrl(absoluteUrlOr(process.env.BASE_URL, "http://localhost:4000"));
const frontendUrl = normalizeUrl(process.env.FRONTEND_URL || "http://localhost:3000");

// The MCP endpoint agents call (#514), as seen from outside: tokens are bound to
// this exact URL, so it must be the public one, not the container address.
export const MCP_RESOURCE = `${baseUrl}/api/mcp`;
// Who signs the agents' tokens: better-auth names itself by its base path.
export const AUTH_ISSUER = `${baseUrl}/api/auth`;
// Also the origins a cookie-carried write must come from (server.ts, #658).
export const trustedOrigins = trustedOriginsFor(baseUrl, frontendUrl);

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
    // A reset is what someone does once they fear their account was taken:
    // the sessions opened before it must not survive it (#658).
    revokeSessionsOnPasswordReset: true,
    // The link points to a frontend page, not to better-auth's own callback
    // (an API route, not navigable), and to the admin or the partner space
    // depending on the account's role (#411).
    sendResetPassword: sendPasswordResetEmail,
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
  user: {
    additionalFields: {
      // User.role exists in the Prisma schema but better-auth does not know it,
      // so it drops the value the create hook sets — a sponsor account then
      // fell back to the column default, EDITOR, which opens the back-office
      // (#362). Declaring it here is what makes the hook's role stick.
      //
      // input: false — the role is never taken from the request body: a signup
      // payload carrying `role: "ADMIN"` must not be able to grant itself one.
      role: {
        type: "string",
        required: false,
        input: false,
      },
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
      // Stored as a hash: a database read must not hand out live sign-in
      // links (#658). Links issued before this change stop working.
      storeToken: "hashed",
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
    // An AI agent (MCP client) connects on behalf of a person (#514). The site
    // becomes an OAuth authorization server for that one resource: the agent
    // gets a token bound to /api/mcp, and /api/mcp then acts with exactly the
    // rights of the person who consented — no account type, no extra role.
    //
    // jwt() signs those tokens (mcp() requires it). Clients identify by a
    // metadata document URL (CIMD) rather than registering: MCP deprecates
    // dynamic registration, and leaving it off means nobody can create clients
    // here. The Node fetcher resolves DNS once and refuses private addresses,
    // the same SSRF guard as our own outbound fetches (#306).
    jwt(),
    mcp({
      loginPage: "/connect",
      consentPage: "/connect/consent",
      resource: MCP_RESOURCE,
      // The provider lets ANY signed-in account create, update and list OAuth
      // clients over HTTP unless told otherwise — a sponsor could mint a
      // confidential client. Clients come from metadata documents (CIMD), which
      // do not go through this check; nobody manages them by hand here.
      clientPrivileges: () => false,
      resourcePrivileges: () => false,
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
  ],
  databaseHooks: {
    // better-auth knows nothing of User.banned (no admin plugin): a banned
    // account could still sign in, and the session it opened outlived the ban
    // (#658). The API refuses it meanwhile; this refuses the session itself.
    session: {
      create: {
        before: async (session) => {
          const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { banned: true } });
          if (owner?.banned) {
            throw new APIError("FORBIDDEN", { message: "Ce compte est suspendu. Contactez un administrateur." });
          }
        },
      },
    },
    user: {
      create: {
        before: async (user) => {
          // Sign-up stays closed (#362): an account is created only for an
          // allow-listed admin, or for someone holding a live invitation to a
          // sponsor space or to an edition's arrivals (#640).
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

          // The mailbox must be proven too (#658): by the identity provider
          // (emailVerified, which a sign-up body cannot set) or by the token,
          // through POST /api/sponsor-invitation/:token/sign-up.
          const isMailboxProven = user.emailVerified === true || isTokenProvenSignUp(user.email);
          if (isMailboxProven && (await hasPendingInvitation(user.email))) {
            // Sponsors get a role that grants nothing in the back-office. The
            // default is EDITOR, which requireAnyAuthenticated lets through —
            // leaving it would hand /api/admin/* to every sponsor.
            return { data: { ...user, role: "SPONSOR", emailVerified: true } };
          }
          // Volunteers invited to the event day (#640): GUEST, explicit for the
          // same reason, through the same mailbox proof.
          if (isMailboxProven && (await hasPendingArrivalsInvitation(user.email))) {
            return { data: { ...user, role: "GUEST", emailVerified: true } };
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
