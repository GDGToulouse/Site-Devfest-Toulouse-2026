import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // --- Edition 2026 ---
  const edition = await prisma.edition.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      startDate: new Date("2026-11-19T09:00:00Z"),
      endDate: new Date("2026-11-19T18:00:00Z"),
      status: "ANNOUNCEMENT",
      aftermovieUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  });

  console.log(`Edition created: ${edition.year} (${edition.status})`);

  // --- Ticket Tiers ---
  const tiers = [
    {
      nameFr: "Blind Bird",
      nameEn: "Blind Bird",
      price: 45.0,
      status: "SOLD_OUT" as const,
      externalUrl: "https://www.billetweb.fr/devfest-toulouse-2026",
      sortOrder: 1,
      editionId: edition.id,
    },
    {
      nameFr: "Normal",
      nameEn: "Normal",
      price: 75.0,
      status: "AVAILABLE" as const,
      externalUrl: "https://www.billetweb.fr/devfest-toulouse-2026",
      sortOrder: 2,
      editionId: edition.id,
    },
    {
      nameFr: "Late Bird",
      nameEn: "Late Bird",
      price: 95.0,
      status: "COMING_SOON" as const,
      externalUrl: "https://www.billetweb.fr/devfest-toulouse-2026",
      sortOrder: 3,
      editionId: edition.id,
    },
  ];

  for (const tier of tiers) {
    await prisma.ticketTier.upsert({
      where: {
        id: tier.sortOrder, // use sortOrder as deterministic id for seeding
      },
      update: {},
      create: tier,
    });
  }

  console.log(`Ticket tiers created: ${tiers.length}`);

  // --- Tags ---
  const tags = [
    { name: "Web", slug: "web" },
    { name: "Cloud", slug: "cloud" },
    { name: "Mobile", slug: "mobile" },
    { name: "IA", slug: "ia" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  // --- Articles ---
  const articles = [
    {
      slug: "cfp-ouvert-2026",
      titleFr: "Le CFP est ouvert !",
      titleEn: "CFP is now open!",
      contentFr:
        "Le Call for Papers du DevFest Toulouse 2026 est officiellement ouvert. Soumettez vos talks avant le 30 juin 2026.",
      contentEn:
        "The Call for Papers for DevFest Toulouse 2026 is officially open. Submit your talks before June 30, 2026.",
      excerptFr: "Soumettez vos talks pour le DevFest Toulouse 2026.",
      excerptEn: "Submit your talks for DevFest Toulouse 2026.",
      imageUrl: "https://picsum.photos/seed/cfp/600/400",
      author: "GDG Toulouse",
      publicationStatus: "PUBLISHED" as const,
      publishedAt: new Date("2026-03-15T10:00:00Z"),
      editionId: edition.id,
    },
    {
      slug: "billetterie-ouverte",
      titleFr: "La billetterie est ouverte",
      titleEn: "Tickets are now available",
      contentFr:
        "Les premiers billets Blind Bird sont disponibles ! Ne tardez pas, ils partent vite.",
      contentEn:
        "Early bird tickets are now available! Don't wait, they sell fast.",
      excerptFr: "Les billets Blind Bird sont disponibles.",
      excerptEn: "Blind Bird tickets are now available.",
      imageUrl: "https://picsum.photos/seed/tickets/600/400",
      author: "GDG Toulouse",
      publicationStatus: "PUBLISHED" as const,
      publishedAt: new Date("2026-03-01T10:00:00Z"),
      editionId: edition.id,
    },
    {
      slug: "nouveau-site-2026",
      titleFr: "Un tout nouveau site pour 2026",
      titleEn: "A brand new website for 2026",
      contentFr:
        "Nous avons entierement repense le site du DevFest Toulouse pour l'edition 2026.",
      contentEn:
        "We have completely redesigned the DevFest Toulouse website for the 2026 edition.",
      excerptFr: "Decouvrez le nouveau site du DevFest Toulouse.",
      excerptEn: "Discover the new DevFest Toulouse website.",
      imageUrl: "https://picsum.photos/seed/website/600/400",
      author: "GDG Toulouse",
      publicationStatus: "PUBLISHED" as const,
      publishedAt: new Date("2026-02-15T10:00:00Z"),
      editionId: edition.id,
    },
    {
      slug: "retour-devfest-2025",
      titleFr: "Retour sur le DevFest Toulouse 2025",
      titleEn: "Looking back at DevFest Toulouse 2025",
      contentFr:
        "L'edition 2025 a ete un succes avec plus de 3000 participants. Retrouvez les chiffres cles.",
      contentEn:
        "The 2025 edition was a success with over 3000 attendees. Check out the key figures.",
      excerptFr: "Les chiffres cles de l'edition 2025.",
      excerptEn: "Key figures from the 2025 edition.",
      imageUrl: "https://picsum.photos/seed/2025/600/400",
      author: "GDG Toulouse",
      publicationStatus: "PUBLISHED" as const,
      publishedAt: new Date("2026-01-10T10:00:00Z"),
      editionId: edition.id,
    },
  ];

  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {},
      create: article,
    });
  }

  console.log(`Articles created: ${articles.length}`);

  // --- Key Figures (SiteSettings) ---
  const keyFigures = [
    {
      icon: "calendar",
      value: "1",
      labelFr: "Journee",
      labelEn: "Day",
    },
    {
      icon: "users",
      value: "3000",
      labelFr: "Participants",
      labelEn: "Attendees",
    },
    {
      icon: "microphone",
      value: "80",
      labelFr: "Conferences",
      labelEn: "Talks",
    },
    {
      icon: "handshake",
      value: "60",
      labelFr: "Stands",
      labelEn: "Booths",
    },
  ];

  for (let i = 0; i < keyFigures.length; i++) {
    const fig = keyFigures[i];
    const prefix = `key_figure_${i + 1}`;

    const entries = [
      { key: `${prefix}_icon`, value: fig.icon },
      { key: `${prefix}_value`, value: fig.value },
      { key: `${prefix}_label_fr`, value: fig.labelFr },
      { key: `${prefix}_label_en`, value: fig.labelEn },
    ];

    for (const entry of entries) {
      await prisma.siteSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: entry,
      });
    }
  }

  console.log(`Key figures settings created: ${keyFigures.length * 4}`);

  console.log("Seeding complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
