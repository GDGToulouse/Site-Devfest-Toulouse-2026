import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Set BASE_URL before importing auth (Better Auth needs it at import time)
process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.ADMIN_EMAILS = process.env.ADMIN_EMAILS || "admin@devfesttoulouse.fr,editor@devfesttoulouse.fr";

const { auth } = await import("../src/lib/auth.js");

const prisma = new PrismaClient();

export async function seedBase() {
  console.log("Seeding database (base)...");

  // --- Contact Categories ---
  const contactCategories = [
    { nameFr: "Sponsoring", nameEn: "Sponsoring", emailRecipients: "sponsors@devfesttoulouse.fr", sortOrder: 1 },
    { nameFr: "Appel à conférences", nameEn: "Call for Papers", emailRecipients: "cfp@devfesttoulouse.fr", sortOrder: 2 },
    { nameFr: "Presse / Média", nameEn: "Press / Media", emailRecipients: "presse@devfesttoulouse.fr", sortOrder: 3 },
  ];

  for (const cat of contactCategories) {
    const existing = await prisma.contactCategory.findFirst({
      where: { nameFr: cat.nameFr },
    });
    if (!existing) {
      await prisma.contactCategory.create({ data: cat });
    }
  }

  console.log(`Contact categories created: ${contactCategories.length}`);

  // --- Contact Default Email ---
  await prisma.siteSetting.upsert({
    where: { key: "contact_default_email" },
    update: {},
    create: { key: "contact_default_email", value: "contact@devfesttoulouse.fr" },
  });

  // --- Admin accounts from ADMIN_EMAILS ---
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e);

  for (const email of adminEmails) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const password = crypto.randomUUID().slice(0, 16);
      try {
        await auth.api.signUpEmail({
          body: { name: email.split("@")[0], email, password },
        });
        await prisma.user.update({
          where: { email },
          data: { role: "ADMIN", emailVerified: true },
        });
        console.log(`Admin account created: ${email} — password: ${password}`);
      } catch (err) {
        await prisma.user.create({
          data: { email, name: email.split("@")[0], role: "ADMIN" },
        });
        console.log(`Admin account created (no password): ${email} — use 'Mot de passe oublié'`);
      }
    } else {
      console.log(`Admin account exists: ${email} (${existing.role})`);
    }
  }

  console.log("Base seeding complete!");
}

export { prisma, auth };

// Run directly when executed as a script (not imported by seed-dev.ts)
if (!process.argv[1]?.includes("seed-dev")) {
  seedBase()
    .then(() => prisma.$disconnect())
    .catch((e: unknown) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
