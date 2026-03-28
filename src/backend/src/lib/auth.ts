import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

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
  socialProviders: {
    google: {
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || "",
    },
  },
});

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}
