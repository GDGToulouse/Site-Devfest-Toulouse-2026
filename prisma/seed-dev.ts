import { seedBase, prisma, auth } from "./seed.js";

// Dev-only test accounts — see docs/comptes-dev-local.md
const DEV_ACCOUNTS = [
  { name: "Admin DevFest", email: "admin@devfesttoulouse.fr", password: "admin1234!dev", role: "ADMIN" as const },
  { name: "Editor DevFest", email: "editor@devfesttoulouse.fr", password: "editor1234!dev", role: "EDITOR" as const },
];

async function seedDev() {
  // Run base seed first (contact categories, admin accounts)
  await seedBase();

  console.log("Seeding dev data...");

  // --- Edition 2026 ---
  const edition = await prisma.edition.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      startDate: new Date("2026-11-19T09:00:00Z"),
      endDate: new Date("2026-11-19T18:00:00Z"),
      status: "ANNOUNCEMENT",
      venueName: "Diagora",
      venueAddress: "Labège",
      cfpUrl: "https://sessionize.com",
      partnerFormUrl: "https://forms.gle/devfest-partenaire",
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
      where: { id: tier.sortOrder },
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

  // --- Articles (12+ for pagination testing) ---
  const tagRecords = await prisma.tag.findMany();
  const tagMap = Object.fromEntries(tagRecords.map((t) => [t.slug, t.id]));

  const articles = [
    { slug: "cfp-ouvert-2026", titleFr: "Le CFP est ouvert !", titleEn: "CFP is now open!", contentFr: "<p>Le Call for Papers du DevFest Toulouse 2026 est officiellement ouvert.</p><h4>Comment soumettre ?</h4><p>Rendez-vous sur <a href='https://sessionize.com'>Sessionize</a> et soumettez vos talks avant le 30 juin 2026. Tous les formats sont acceptés : conférences (40 min), quickies (20 min) et keynotes.</p><p>Les sujets couvrent le web, le cloud, le mobile, l'IA, la sécurité et bien plus encore.</p>", contentEn: "<p>The Call for Papers for DevFest Toulouse 2026 is officially open.</p><h4>How to submit?</h4><p>Go to <a href='https://sessionize.com'>Sessionize</a> and submit your talks before June 30, 2026. All formats accepted: talks (40 min), quickies (20 min) and keynotes.</p><p>Topics cover web, cloud, mobile, AI, security and more.</p>", excerptFr: "Soumettez vos talks pour le DevFest Toulouse 2026.", excerptEn: "Submit your talks for DevFest Toulouse 2026.", imageUrl: "https://picsum.photos/seed/cfp/600/400", author: "GDG Toulouse", publishedAt: new Date("2026-03-15T10:00:00Z"), tags: ["web", "cloud"] },
    { slug: "billetterie-ouverte", titleFr: "La billetterie est ouverte", titleEn: "Tickets are now available", contentFr: "<p>Les premiers billets Blind Bird sont disponibles ! Ne tardez pas, ils partent vite.</p><p>Le tarif Blind Bird est de 45 euros. Le tarif normal sera de 75 euros.</p>", contentEn: "<p>Early bird tickets are now available! Don't wait, they sell fast.</p><p>Blind Bird price is 45 euros. Normal price will be 75 euros.</p>", excerptFr: "Les billets Blind Bird sont disponibles.", excerptEn: "Blind Bird tickets are now available.", imageUrl: "https://picsum.photos/seed/tickets/600/400", author: "GDG Toulouse", publishedAt: new Date("2026-03-01T10:00:00Z"), tags: [] },
    { slug: "nouveau-site-2026", titleFr: "Un tout nouveau site pour 2026", titleEn: "A brand new website for 2026", contentFr: "<p>Nous avons entièrement repensé le site du DevFest Toulouse pour l'édition 2026.</p><p>Nouveau design, nouvelles fonctionnalités, meilleures performances.</p>", contentEn: "<p>We completely redesigned the DevFest Toulouse website for the 2026 edition.</p><p>New design, new features, better performance.</p>", excerptFr: "Découvrez le nouveau site du DevFest Toulouse.", excerptEn: "Discover the new DevFest Toulouse website.", imageUrl: "https://picsum.photos/seed/website/600/400", author: "GDG Toulouse", publishedAt: new Date("2026-02-15T10:00:00Z"), tags: ["web"] },
    { slug: "retour-devfest-2025", titleFr: "Retour sur le DevFest Toulouse 2025", titleEn: "Looking back at DevFest Toulouse 2025", contentFr: "<p>L'édition 2025 a été un succès avec plus de 3000 participants.</p><h4>Chiffres clés</h4><ul><li>3000 participants</li><li>80 conférences</li><li>60 stands partenaires</li></ul>", contentEn: "<p>The 2025 edition was a success with over 3000 attendees.</p><h4>Key figures</h4><ul><li>3000 attendees</li><li>80 talks</li><li>60 partner booths</li></ul>", excerptFr: "Les chiffres clés de l'édition 2025.", excerptEn: "Key figures from the 2025 edition.", imageUrl: "https://picsum.photos/seed/2025/600/400", author: "GDG Toulouse", publishedAt: new Date("2026-01-10T10:00:00Z"), tags: [] },
    { slug: "kubernetes-production", titleFr: "Kubernetes en production : retour d'expérience", titleEn: "Kubernetes in production: lessons learned", contentFr: "<p>Déployer Kubernetes en production n'est pas trivial. Voici nos retours après 2 ans d'utilisation.</p>", contentEn: "<p>Deploying Kubernetes in production is not trivial. Here are our takeaways after 2 years.</p>", excerptFr: "Retour d'expérience sur Kubernetes en production.", excerptEn: "Lessons learned from Kubernetes in production.", imageUrl: "https://picsum.photos/seed/k8s/600/400", author: "Marie Dupont", publishedAt: new Date("2025-12-20T10:00:00Z"), tags: ["cloud"] },
    { slug: "flutter-2026", titleFr: "Flutter 5 : les nouveautés", titleEn: "Flutter 5: what's new", contentFr: "<p>Flutter 5 apporte de nombreuses améliorations de performance et de nouveaux widgets.</p>", contentEn: "<p>Flutter 5 brings many performance improvements and new widgets.</p>", excerptFr: "Découvrez les nouveautés de Flutter 5.", excerptEn: "Discover what's new in Flutter 5.", imageUrl: "https://picsum.photos/seed/flutter/600/400", author: "Pierre Martin", publishedAt: new Date("2025-12-05T10:00:00Z"), tags: ["mobile"] },
    { slug: "ia-generative-devs", titleFr: "L'IA générative pour les développeurs", titleEn: "Generative AI for developers", contentFr: "<p>Comment les développeurs peuvent tirer parti de l'IA générative au quotidien.</p>", contentEn: "<p>How developers can leverage generative AI in their daily workflow.</p>", excerptFr: "L'IA générative au service des développeurs.", excerptEn: "Generative AI at the service of developers.", imageUrl: "https://picsum.photos/seed/ai/600/400", author: "Sophie Laurent", publishedAt: new Date("2025-11-20T10:00:00Z"), tags: ["ia"] },
    { slug: "web-components-2026", titleFr: "Web Components : le renouveau", titleEn: "Web Components: the revival", contentFr: "<p>Les Web Components reviennent en force en 2026 avec de nouvelles APIs navigateur.</p>", contentEn: "<p>Web Components are making a strong comeback in 2026 with new browser APIs.</p>", excerptFr: "Les Web Components en 2026.", excerptEn: "Web Components in 2026.", imageUrl: "https://picsum.photos/seed/wc/600/400", author: "Lucas Bernard", publishedAt: new Date("2025-11-10T10:00:00Z"), tags: ["web"] },
    { slug: "securite-api-rest", titleFr: "Sécuriser ses APIs REST", titleEn: "Securing your REST APIs", contentFr: "<p>Bonnes pratiques pour sécuriser vos APIs REST : authentification, autorisation, rate limiting.</p>", contentEn: "<p>Best practices for securing your REST APIs: authentication, authorization, rate limiting.</p>", excerptFr: "Bonnes pratiques de sécurité pour les APIs REST.", excerptEn: "Security best practices for REST APIs.", imageUrl: "https://picsum.photos/seed/security/600/400", author: "GDG Toulouse", publishedAt: new Date("2025-10-25T10:00:00Z"), tags: ["web", "cloud"] },
    { slug: "react-server-components", titleFr: "React Server Components en pratique", titleEn: "React Server Components in practice", contentFr: "<p>Les React Server Components changent la façon de construire des applications web.</p>", contentEn: "<p>React Server Components are changing how we build web applications.</p>", excerptFr: "Les RSC en pratique.", excerptEn: "RSC in practice.", imageUrl: "https://picsum.photos/seed/rsc/600/400", author: "Emma Petit", publishedAt: new Date("2025-10-10T10:00:00Z"), tags: ["web"] },
    { slug: "gcp-serverless", titleFr: "Google Cloud : le tout serverless", titleEn: "Google Cloud: going fully serverless", contentFr: "<p>Migrer vers une architecture 100% serverless sur Google Cloud Platform.</p>", contentEn: "<p>Migrating to a 100% serverless architecture on Google Cloud Platform.</p>", excerptFr: "Architecture serverless sur GCP.", excerptEn: "Serverless architecture on GCP.", imageUrl: "https://picsum.photos/seed/gcp/600/400", author: "Thomas Roux", publishedAt: new Date("2025-09-15T10:00:00Z"), tags: ["cloud"] },
    { slug: "accessibilite-web", titleFr: "Accessibilité web : par où commencer", titleEn: "Web accessibility: where to start", contentFr: "<p>Guide pratique pour rendre vos applications web accessibles à tous.</p>", contentEn: "<p>A practical guide to making your web applications accessible to everyone.</p>", excerptFr: "Guide pratique d'accessibilité web.", excerptEn: "Practical web accessibility guide.", imageUrl: "https://picsum.photos/seed/a11y/600/400", author: "Julie Moreau", publishedAt: new Date("2025-09-01T10:00:00Z"), tags: ["web"] },
  ];

  for (const { tags: tagSlugs, ...articleData } of articles) {
    const connectTags = tagSlugs
      .filter((slug) => tagMap[slug])
      .map((slug) => ({ id: tagMap[slug] }));

    await prisma.article.upsert({
      where: { slug: articleData.slug },
      update: {},
      create: {
        ...articleData,
        publicationStatus: "PUBLISHED",
        editionId: edition.id,
        tags: { connect: connectTags },
      },
    });
  }

  console.log(`Articles created: ${articles.length}`);

  // --- Content Pages ---
  await prisma.contentPage.upsert({
    where: { slug: "code-de-conduite" },
    update: {},
    create: {
      slug: "code-de-conduite",
      titleFr: "Code de conduite",
      titleEn: "Code of Conduct",
      contentFr: "<h4>Notre engagement</h4><p>Le DevFest Toulouse s'engage à offrir une expérience de conférence sans harcèlement pour tous, indépendamment du genre, de l'identité de genre, de l'âge, de l'orientation sexuelle, du handicap, de l'apparence physique, de la taille, de la race, de l'ethnie, de la religion (ou de l'absence de religion), ou des choix technologiques.</p><h4>Comportement attendu</h4><ul><li>Faire preuve de considération et de respect envers les autres participants</li><li>S'abstenir de tout comportement ou propos discriminatoire, harcelant ou dégradant</li><li>Alerter les organisateurs en cas de situation problématique</li></ul><h4>Comportements inacceptables</h4><p>Le harcèlement comprend, sans s'y limiter : les commentaires offensants, l'intimidation, la photographie ou l'enregistrement non consenti, le contact physique indésiré.</p><h4>Conséquences</h4><p>Tout participant qui ne respecte pas ce code de conduite pourra être expulsé de l'événement sans remboursement, à la discrétion des organisateurs.</p><p>Basé sur le <a href='https://berlincodeofconduct.org/'>Berlin Code of Conduct</a>.</p>",
      contentEn: "<h4>Our pledge</h4><p>DevFest Toulouse is committed to providing a harassment-free conference experience for everyone, regardless of gender, gender identity, age, sexual orientation, disability, physical appearance, body size, race, ethnicity, religion (or lack thereof), or technology choices.</p><h4>Expected behavior</h4><ul><li>Be considerate and respectful towards other attendees</li><li>Refrain from any discriminatory, harassing, or degrading behavior or speech</li><li>Alert organizers if you witness a problematic situation</li></ul><h4>Unacceptable behavior</h4><p>Harassment includes, but is not limited to: offensive comments, intimidation, non-consensual photography or recording, unwanted physical contact.</p><h4>Consequences</h4><p>Any participant who violates this code of conduct may be expelled from the event without a refund, at the discretion of the organizers.</p><p>Based on the <a href='https://berlincodeofconduct.org/'>Berlin Code of Conduct</a>.</p>",
    },
  });

  await prisma.contentPage.upsert({
    where: { slug: "mentions-legales" },
    update: {},
    create: {
      slug: "mentions-legales",
      titleFr: "Mentions légales",
      titleEn: "Legal Notice",
      contentFr: "<h4>Éditeur du site</h4><p>Association GDG Toulouse<br>Adresse : Toulouse, France<br>Email : contact@devfesttoulouse.fr</p><h4>Hébergement</h4><p>Ce site est hébergé par OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.</p><h4>Données personnelles et RGPD</h4><p>Les données collectées via le formulaire de contact sont utilisées uniquement pour répondre à vos demandes. Elles sont conservées pendant 12 mois puis supprimées. Vous pouvez exercer vos droits d'accès, de rectification et de suppression en contactant contact@devfesttoulouse.fr.</p><h4>Cookies</h4><p>Ce site n'utilise pas de cookies de tracking. Seuls des cookies techniques strictement nécessaires au fonctionnement du site sont utilisés.</p>",
      contentEn: "<h4>Website publisher</h4><p>GDG Toulouse Association<br>Address: Toulouse, France<br>Email: contact@devfesttoulouse.fr</p><h4>Hosting</h4><p>This website is hosted by OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.</p><h4>Personal data and GDPR</h4><p>Data collected through the contact form is used solely to respond to your requests. It is retained for 12 months and then deleted. You can exercise your rights of access, rectification and deletion by contacting contact@devfesttoulouse.fr.</p><h4>Cookies</h4><p>This website does not use tracking cookies. Only strictly necessary technical cookies are used.</p>",
    },
  });

  console.log("Content pages created: 2");

  // --- Key Figures (per-Edition) ---
  await prisma.keyFigure.deleteMany({ where: { editionId: edition.id } });
  const keyFigures = [
    { icon: "calendar", value: "1", labelFr: "Journée", labelEn: "Day", sortOrder: 0 },
    { icon: "users", value: "3000", labelFr: "Participants", labelEn: "Attendees", sortOrder: 1 },
    { icon: "microphone", value: "80", labelFr: "Conférences", labelEn: "Talks", sortOrder: 2 },
    { icon: "handshake", value: "60", labelFr: "Stands", labelEn: "Booths", sortOrder: 3 },
  ];
  await prisma.keyFigure.createMany({
    data: keyFigures.map((fig) => ({ ...fig, editionId: edition.id })),
  });

  console.log(`Key figures created: ${keyFigures.length}`);

  // --- CFP Settings ---
  const cfpSettings = [
    { key: "cfp_is_open", value: "true" },
    { key: "cfp_sessionize_url", value: "https://sessionize.com/devfest-toulouse-2026" },
    { key: "cfp_open_date", value: "2026-03-15" },
    { key: "cfp_close_date", value: "2026-05-31" },
  ];

  for (const entry of cfpSettings) {
    await prisma.siteSetting.upsert({
      where: { key: entry.key },
      update: { value: entry.value },
      create: entry,
    });
  }

  console.log(`CFP settings created: ${cfpSettings.length}`);

  // --- Dev test accounts (with passwords) ---
  for (const account of DEV_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (!existing) {
      try {
        await auth.api.signUpEmail({
          body: {
            name: account.name,
            email: account.email,
            password: account.password,
          },
        });
        await prisma.user.update({
          where: { email: account.email },
          data: { role: account.role, emailVerified: true },
        });
        console.log(`Dev account created: ${account.email} (${account.role}) — password: ${account.password}`);
      } catch (err) {
        await prisma.user.create({
          data: { email: account.email, name: account.name, role: account.role },
        });
        console.log(`Dev account created (no password): ${account.email} (${account.role}) — use 'Mot de passe oublié'`);
      }
    } else {
      await prisma.user.update({ where: { email: account.email }, data: { role: account.role } });
      console.log(`Dev account exists: ${account.email} (${existing.role})`);
    }
  }

  console.log("Dev seeding complete!");
}

seedDev()
  .then(() => prisma.$disconnect())
  .catch((e: unknown) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
