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
  // "Sponsoring" stays a public, generic bucket for sponsoring questions
  // sent through the /contact page (no automatic brochure email).
  // "sponsor-brochure" is the hidden category used only by the brochure
  // request form on /devenir-sponsor: receivers are the same, but the
  // confirmation email contains the per-message tracked brochure link.
  const contactCategories = [
    {
      nameFr: "Sponsoring", nameEn: "Sponsoring",
      emailRecipients: "sponsors@devfesttoulouse.fr", sortOrder: 1,
      slug: "sponsoring", isSystem: true, isPublic: true,
    },
    {
      nameFr: "Demande de plaquette sponsor", nameEn: "Sponsor brochure request",
      emailRecipients: "sponsors@devfesttoulouse.fr", sortOrder: 2,
      slug: "sponsor-brochure", isSystem: true, isPublic: false,
      confirmationSubjectFr: "[DevFest Toulouse 2026] Votre dossier de sponsoring",
      confirmationSubjectEn: "[DevFest Toulouse 2026] Your sponsorship brochure",
      confirmationBodyFr: "Bonjour {firstName} {lastName},\n\nMerci de l'intérêt que vous portez au DevFest Toulouse.\n\nVous pouvez consulter la plaquette sponsor à <a href=\"{brochureUrl}\">cette adresse</a>.\n\nSi vous avez des questions, nous sommes là pour y répondre.\nNous vous recontacterons d'ici quelques jours pour étudier la meilleure formule pour vous.\n\nDevFestement,\nLes organisateurs du DevFest Toulouse",
      confirmationBodyEn: "Hello {firstName} {lastName},\n\nThank you for your interest in DevFest Toulouse.\n\nYou can download the sponsor brochure at <a href=\"{brochureUrl}\">this link</a>.\n\nIf you have any questions, we are happy to help.\nWe will get back to you within a few days to find the best option for you.\n\nBest regards,\nThe DevFest Toulouse organizers",
    },
    { nameFr: "Appel à conférences", nameEn: "Call for Papers", emailRecipients: "cfp@devfesttoulouse.fr", sortOrder: 3, slug: "cfp", isPublic: true },
    { nameFr: "Presse / Média", nameEn: "Press / Media", emailRecipients: "presse@devfesttoulouse.fr", sortOrder: 4, slug: "presse", isPublic: true },
  ];

  for (const cat of contactCategories) {
    const existing = await prisma.contactCategory.findFirst({
      where: { OR: [{ slug: cat.slug }, { nameFr: cat.nameFr }] },
    });
    if (!existing) {
      await prisma.contactCategory.create({ data: cat });
    } else {
      // Backfill slug/isSystem/isPublic on existing categories.
      await prisma.contactCategory.update({
        where: { id: existing.id },
        data: {
          slug: cat.slug,
          isSystem: cat.isSystem ?? false,
          isPublic: cat.isPublic ?? true,
          ...(cat.confirmationSubjectFr && !existing.confirmationSubjectFr ? {
            confirmationSubjectFr: cat.confirmationSubjectFr,
            confirmationSubjectEn: cat.confirmationSubjectEn,
            confirmationBodyFr: cat.confirmationBodyFr,
            confirmationBodyEn: cat.confirmationBodyEn,
          } : {}),
        },
      });
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
