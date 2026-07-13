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
      sponsorFormUrl: "https://forms.gle/devfest-sponsor",
      aftermovieUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  });

  console.log(`Edition created: ${edition.year} (${edition.status})`);

  // --- Featured Edition Setting ---
  await prisma.siteSetting.upsert({
    where: { key: "featured_edition_id" },
    update: { value: String(edition.id) },
    create: { key: "featured_edition_id", value: String(edition.id) },
  });
  console.log(`Featured edition set to: ${edition.year}`);

  // --- Ticket Tiers ---
  const tiers = [
    {
      nameFr: "Blind Bird",
      nameEn: "Blind Bird",
      price: 45.0,
      isVisible: true,
      saleStartDate: new Date("2026-01-01"),
      saleEndDate: new Date("2026-03-01"),
      externalUrl: "https://www.billetweb.fr/devfest-toulouse-2026",
      sortOrder: 1,
      editionId: edition.id,
    },
    {
      nameFr: "Normal",
      nameEn: "Normal",
      price: 75.0,
      isVisible: true,
      saleStartDate: new Date("2026-03-01"),
      saleEndDate: null,
      externalUrl: "https://www.billetweb.fr/devfest-toulouse-2026",
      sortOrder: 2,
      editionId: edition.id,
    },
    {
      nameFr: "Late Bird",
      nameEn: "Late Bird",
      price: 95.0,
      isVisible: true,
      saleStartDate: new Date("2026-10-01"),
      saleEndDate: null,
      externalUrl: "https://www.billetweb.fr/devfest-toulouse-2026",
      sortOrder: 3,
      editionId: edition.id,
    },
  ];

  for (const tier of tiers) {
    await prisma.ticketTier.upsert({
      where: { editionId_sortOrder: { editionId: tier.editionId, sortOrder: tier.sortOrder } },
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
        editions: { connect: [{ id: edition.id }] },
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

  // --- Edition 2025 (past edition for bilan page) ---
  const edition2025 = await prisma.edition.upsert({
    where: { year: 2025 },
    update: {
      status: "SEE_YOU_NEXT_YEAR",
      startDate: new Date("2025-11-06T09:00:00Z"),
      endDate: new Date("2025-11-06T18:00:00Z"),
      venueName: "Centre de Congrès Pierre Baudis",
      venueAddress: "Toulouse",
      aftermovieUrl: "https://www.youtube.com/watch?v=nCjk1T8G1WE",
      galleryUrl: "https://photos.app.goo.gl/devfest2025",
      archivedSiteUrl: "https://2025.devfesttoulouse.fr",
    },
    create: {
      year: 2025,
      startDate: new Date("2025-11-06T09:00:00Z"),
      endDate: new Date("2025-11-06T18:00:00Z"),
      status: "SEE_YOU_NEXT_YEAR",
      venueName: "Centre de Congrès Pierre Baudis",
      venueAddress: "Toulouse",
      aftermovieUrl: "https://www.youtube.com/watch?v=nCjk1T8G1WE",
      galleryUrl: "https://photos.app.goo.gl/devfest2025",
      archivedSiteUrl: "https://2025.devfesttoulouse.fr",
    },
  });
  console.log(`Edition created: ${edition2025.year} (${edition2025.status})`);

  // --- Key Figures for 2025 ---
  await prisma.keyFigure.deleteMany({ where: { editionId: edition2025.id } });
  const keyFigures2025 = [
    { icon: "calendar", value: "1", labelFr: "Journée", labelEn: "Day", sortOrder: 0 },
    { icon: "users", value: "2800", labelFr: "Participants", labelEn: "Attendees", sortOrder: 1 },
    { icon: "microphone", value: "72", labelFr: "Conférences", labelEn: "Talks", sortOrder: 2 },
    { icon: "handshake", value: "50", labelFr: "Stands", labelEn: "Booths", sortOrder: 3 },
  ];
  await prisma.keyFigure.createMany({
    data: keyFigures2025.map((fig) => ({ ...fig, editionId: edition2025.id })),
  });
  console.log(`Key figures 2025 created: ${keyFigures2025.length}`);

  // --- Sponsor Plans for 2026 ---
  await prisma.sponsorPlan.deleteMany({ where: { editionId: edition.id } });
  const sponsorPlans = [
    {
      nameFr: "Platinum", nameEn: "Platinum",
      subtitleFr: "Au dessus de la mêlée !", subtitleEn: "Above the pack!",
      descriptionFr: "La visibilité la plus complète avec un grand stand pour vous mettre en avant.",
      descriptionEn: "The most comprehensive visibility with a large booth to showcase your brand.",
      price: null, standSize: "12m²",
      advantages: JSON.stringify([
        { fr: "Stand premium de 12m²", en: "Premium 12m² booth" },
        { fr: "Logo sur tous les supports de communication", en: "Logo on all communication materials" },
        { fr: "Visibilité maximale sur le site web", en: "Maximum visibility on the website" },
        { fr: "Posts dédiés sur les réseaux sociaux", en: "Dedicated social media posts" },
        { fr: "Billets inclus pour votre équipe", en: "Included tickets for your team" },
        { fr: "Logo sur le badge des participants", en: "Logo on attendee badges" },
        { fr: "Intervention sur scène", en: "On-stage speaking slot" },
        { fr: "Accès à la liste des participants (opt-in)", en: "Access to attendee list (opt-in)" },
      ]),
      color: "#41B38E", isFeatured: false, isVisible: true, sortOrder: 1, editionId: edition.id,
    },
    {
      nameFr: "Gold", nameEn: "Gold",
      subtitleFr: "Le Best-seller", subtitleEn: "The Best-seller",
      descriptionFr: "Le stand idéal pour être au contact des participants et promouvoir votre marque.",
      descriptionEn: "The ideal booth to connect with attendees and promote your brand.",
      price: null, standSize: "6m²",
      advantages: JSON.stringify([
        { fr: "Stand de 6m²", en: "6m² booth" },
        { fr: "Logo sur le site web", en: "Logo on the website" },
        { fr: "Mention sur les réseaux sociaux", en: "Social media mention" },
        { fr: "Billets inclus pour votre équipe", en: "Included tickets for your team" },
        { fr: "Logo sur les supports de communication", en: "Logo on communication materials" },
        { fr: "Roll-up sur le stand", en: "Roll-up at the booth" },
      ]),
      color: "#FFD428", isFeatured: true, isVisible: true, sortOrder: 2, editionId: edition.id,
    },
    {
      nameFr: "Discovery", nameEn: "Discovery",
      subtitleFr: "Un coup de pouce aux PME", subtitleEn: "A boost for SMEs",
      descriptionFr: "Un format accessible pour les PME souhaitant se faire connaître auprès de la communauté tech.",
      descriptionEn: "An accessible format for SMEs wanting to get known in the tech community.",
      price: null, standSize: "2m²",
      advantages: JSON.stringify([
        { fr: "Stand de 2m²", en: "2m² booth" },
        { fr: "Logo sur le site web", en: "Logo on the website" },
        { fr: "Mention sur les réseaux sociaux", en: "Social media mention" },
        { fr: "Billets inclus", en: "Included tickets" },
      ]),
      color: "#EE7CAD", isFeatured: false, isVisible: true, sortOrder: 3, editionId: edition.id,
    },
    {
      nameFr: "Soutien", nameEn: "Support",
      subtitleFr: "Visibilité numérique", subtitleEn: "Digital visibility",
      descriptionFr: "Associez votre marque à l'événement sans avoir à gérer un stand physique.",
      descriptionEn: "Associate your brand with the event without managing a physical booth.",
      price: null, standSize: null,
      advantages: JSON.stringify([
        { fr: "Logo sur le site web", en: "Logo on the website" },
        { fr: "Mention sur les réseaux sociaux", en: "Social media mention" },
        { fr: "Billets inclus", en: "Included tickets" },
        { fr: "Visibilité sur les écrans de l'événement", en: "Visibility on event screens" },
      ]),
      color: "#507BBD", isFeatured: false, isVisible: true, sortOrder: 4, editionId: edition.id,
    },
  ];
  await prisma.sponsorPlan.createMany({ data: sponsorPlans });
  console.log(`Sponsor plans created: ${sponsorPlans.length}`);

  // --- Lot 2: Categories, Sponsors, Speakers, Talks (dev sample data) ---
  // Wipe in dependency order so re-running the dev seed is idempotent.
  await prisma.talk.deleteMany({ where: { editionId: edition.id } });
  await prisma.speaker.deleteMany({ where: { editionId: edition.id } });
  await prisma.sponsor.deleteMany({ where: { editionId: edition.id } });
  await prisma.category.deleteMany({ where: { editionId: edition.id } });

  const catCloud = await prisma.category.create({
    data: { nameFr: "Cloud & DevOps", nameEn: "Cloud & DevOps", color: "#509EE3", sortOrder: 0, editionId: edition.id },
  });
  const catWeb = await prisma.category.create({
    data: { nameFr: "Web & Mobile", nameEn: "Web & Mobile", color: "#EC6839", sortOrder: 1, editionId: edition.id },
  });
  console.log("Categories created: 2");

  // A realistic sponsor wall: 4 Platinum, 16 Gold, 8 Soutien. Every field is
  // filled (logo, both descriptions, website, socials, contact email) so the
  // public pages and the admin forms can be exercised for real. Logos are
  // placeholder SVGs under public/images/sponsors/ — see the slugs below.
  const DEMO_SPONSORS: Array<{
    slug: string;
    name: string;
    level: "PLATINUM" | "GOLD" | "SOUTIEN";
    descriptionFr: string;
    descriptionEn: string;
    websiteUrl: string;
  }> = [
    { slug: "airbus-tech", name: "Airbus Tech", level: "PLATINUM",
      descriptionFr: "Pôle logiciel embarqué et cloud souverain de l'avionneur toulousain. Nos équipes conçoivent les systèmes critiques qui volent chaque jour.",
      descriptionEn: "Embedded software and sovereign cloud division of the Toulouse aircraft manufacturer. Our teams build the critical systems that fly every day.",
      websiteUrl: "https://example.com/airbus-tech" },
    { slug: "capgemini-sud", name: "Capgemini Sud", level: "PLATINUM",
      descriptionFr: "Conseil et ingénierie logicielle en Occitanie. Nous accompagnons la transformation numérique des grands comptes régionaux.",
      descriptionEn: "Consulting and software engineering in Occitanie. We drive the digital transformation of major regional accounts.",
      websiteUrl: "https://example.com/capgemini-sud" },
    { slug: "orange-business", name: "Orange Business", level: "PLATINUM",
      descriptionFr: "Opérateur et intégrateur de services numériques. Réseaux, cybersécurité et plateformes de données pour les entreprises.",
      descriptionEn: "Carrier and digital services integrator. Networks, cybersecurity and data platforms for businesses.",
      websiteUrl: "https://example.com/orange-business" },
    { slug: "thales-digital", name: "Thales Digital", level: "PLATINUM",
      descriptionFr: "Technologies de confiance pour l'aérospatial, la défense et le transport. R&D logicielle basée à Toulouse.",
      descriptionEn: "Trusted technologies for aerospace, defence and transport. Software R&D based in Toulouse.",
      websiteUrl: "https://example.com/thales-digital" },

    { slug: "sopra-steria", name: "Sopra Steria", level: "GOLD",
      descriptionFr: "ESN européenne, forte présence à Toulouse sur les projets aéronautiques et bancaires.",
      descriptionEn: "European IT services firm with a strong Toulouse presence in aerospace and banking projects.",
      websiteUrl: "https://example.com/sopra-steria" },
    { slug: "atos-occitanie", name: "Atos Occitanie", level: "GOLD",
      descriptionFr: "Cloud, cybersécurité et calcul haute performance au service des acteurs régionaux.",
      descriptionEn: "Cloud, cybersecurity and high-performance computing for regional players.",
      websiteUrl: "https://example.com/atos-occitanie" },
    { slug: "cgi-toulouse", name: "CGI Toulouse", level: "GOLD",
      descriptionFr: "Conseil en management et intégration de systèmes, avec une practice Data & IA locale.",
      descriptionEn: "Management consulting and systems integration, with a local Data & AI practice.",
      websiteUrl: "https://example.com/cgi-toulouse" },
    { slug: "akka-tech", name: "Akka Technologies", level: "GOLD",
      descriptionFr: "Ingénierie et conseil en technologies, spécialiste des systèmes embarqués.",
      descriptionEn: "Engineering and technology consulting, specialised in embedded systems.",
      websiteUrl: "https://example.com/akka-tech" },
    { slug: "altran-sud", name: "Altran Sud", level: "GOLD",
      descriptionFr: "Ingénierie de la R&D externalisée pour l'industrie aéronautique et spatiale.",
      descriptionEn: "Outsourced R&D engineering for the aerospace industry.",
      websiteUrl: "https://example.com/altran-sud" },
    { slug: "scalian-labs", name: "Scalian Labs", level: "GOLD",
      descriptionFr: "Systèmes numériques critiques, qualité et performance opérationnelle.",
      descriptionEn: "Critical digital systems, quality and operational performance.",
      websiteUrl: "https://example.com/scalian-labs" },
    { slug: "expleo-group", name: "Expleo Group", level: "GOLD",
      descriptionFr: "Ingénierie, qualité et conseil en transformation, du prototype à la série.",
      descriptionEn: "Engineering, quality and transformation consulting, from prototype to production.",
      websiteUrl: "https://example.com/expleo-group" },
    { slug: "niji-toulouse", name: "Niji Toulouse", level: "GOLD",
      descriptionFr: "Cabinet de conseil et agence digitale : produit, design et développement.",
      descriptionEn: "Consulting firm and digital agency: product, design and development.",
      websiteUrl: "https://example.com/niji-toulouse" },
    { slug: "onepoint-occ", name: "Onepoint Occitanie", level: "GOLD",
      descriptionFr: "Architecte des grandes transformations, du conseil à la mise en œuvre.",
      descriptionEn: "Architect of large-scale transformations, from advice to delivery.",
      websiteUrl: "https://example.com/onepoint-occ" },
    { slug: "devoteam-sud", name: "Devoteam Sud", level: "GOLD",
      descriptionFr: "Cloud, data et cybersécurité. Partenaire des principaux hyperscalers.",
      descriptionEn: "Cloud, data and cybersecurity. Partner of the major hyperscalers.",
      websiteUrl: "https://example.com/devoteam-sud" },
    { slug: "ippon-tech", name: "Ippon Technologies", level: "GOLD",
      descriptionFr: "Cabinet de conseil et de développement : craft, cloud et data engineering.",
      descriptionEn: "Consulting and development firm: software craft, cloud and data engineering.",
      websiteUrl: "https://example.com/ippon-tech" },
    { slug: "zenika-toulouse", name: "Zenika Toulouse", level: "GOLD",
      descriptionFr: "Conseil, réalisation et formation autour des technologies open source.",
      descriptionEn: "Consulting, delivery and training around open source technologies.",
      websiteUrl: "https://example.com/zenika-toulouse" },
    { slug: "octo-tech", name: "OCTO Technology", level: "GOLD",
      descriptionFr: "There is a better way. Architecture, agilité et culture produit.",
      descriptionEn: "There is a better way. Architecture, agility and product culture.",
      websiteUrl: "https://example.com/octo-tech" },
    { slug: "theodo-cloud", name: "Theodo Cloud", level: "GOLD",
      descriptionFr: "Experts serverless et plateformes cloud natives, du POC à la production.",
      descriptionEn: "Serverless and cloud-native platform experts, from PoC to production.",
      websiteUrl: "https://example.com/theodo-cloud" },
    { slug: "shodo-occitanie", name: "Shodo Occitanie", level: "GOLD",
      descriptionFr: "Collectif d'artisans du logiciel, attaché à la qualité et à l'humain.",
      descriptionEn: "A collective of software craftspeople, committed to quality and to people.",
      websiteUrl: "https://example.com/shodo-occitanie" },
    { slug: "kaizen-solutions", name: "Kaizen Solutions", level: "GOLD",
      descriptionFr: "Amélioration continue appliquée aux systèmes d'information.",
      descriptionEn: "Continuous improvement applied to information systems.",
      websiteUrl: "https://example.com/kaizen-solutions" },

    { slug: "la-melee", name: "La Mêlée Numérique", level: "SOUTIEN",
      descriptionFr: "Association qui fédère l'écosystème numérique d'Occitanie depuis plus de vingt ans.",
      descriptionEn: "The association bringing together Occitanie's digital ecosystem for over twenty years.",
      websiteUrl: "https://example.com/la-melee" },
    { slug: "toulouse-tech-hub", name: "Toulouse Tech Hub", level: "SOUTIEN",
      descriptionFr: "Point de rencontre des startups et des talents tech du bassin toulousain.",
      descriptionEn: "Meeting point for the startups and tech talent of the Toulouse area.",
      websiteUrl: "https://example.com/toulouse-tech-hub" },
    { slug: "digital-113", name: "Digital 113", level: "SOUTIEN",
      descriptionFr: "Cluster des entreprises du numérique en Occitanie.",
      descriptionEn: "Cluster of digital companies in Occitanie.",
      websiteUrl: "https://example.com/digital-113" },
    { slug: "at-home-coworking", name: "At Home Coworking", level: "SOUTIEN",
      descriptionFr: "Espaces de coworking au cœur de Toulouse, ouverts aux communautés tech.",
      descriptionEn: "Coworking spaces in the heart of Toulouse, open to tech communities.",
      websiteUrl: "https://example.com/at-home-coworking" },
    { slug: "harry-cover", name: "Harry Cover Studio", level: "SOUTIEN",
      descriptionFr: "Studio de création graphique et d'illustration, partenaire visuel de l'événement.",
      descriptionEn: "Graphic design and illustration studio, the event's visual partner.",
      websiteUrl: "https://example.com/harry-cover" },
    { slug: "le-connecteur", name: "Le Connecteur", level: "SOUTIEN",
      descriptionFr: "Tiers-lieu dédié à l'innovation et à l'entrepreneuriat.",
      descriptionEn: "A third place dedicated to innovation and entrepreneurship.",
      websiteUrl: "https://example.com/le-connecteur" },
    { slug: "cafe-et-code", name: "Café & Code", level: "SOUTIEN",
      descriptionFr: "Torréfacteur local qui réveille les développeurs depuis 2016.",
      descriptionEn: "The local coffee roaster that has been waking developers up since 2016.",
      websiteUrl: "https://example.com/cafe-et-code" },
    { slug: "pink-lab", name: "Pink Innovation Lab", level: "SOUTIEN",
      descriptionFr: "Laboratoire d'innovation ouverte, incubateur de projets communautaires.",
      descriptionEn: "Open innovation lab, incubator of community projects.",
      websiteUrl: "https://example.com/pink-lab" },
  ];

  for (const s of DEMO_SPONSORS) {
    await prisma.sponsor.create({
      data: {
        slug: s.slug,
        name: s.name,
        level: s.level,
        logoUrl: `/images/sponsors/${s.slug}.svg`,
        websiteUrl: s.websiteUrl,
        descriptionFr: s.descriptionFr,
        descriptionEn: s.descriptionEn,
        socialLinks: JSON.stringify({
          linkedin: `https://www.linkedin.com/company/${s.slug}`,
          twitter: `https://x.com/${s.slug.replace(/-/g, "")}`,
          github: `https://github.com/${s.slug}`,
        }),
        contactEmail: `contact@${s.slug}.example.com`,
        publicationStatus: "PUBLISHED",
        editionId: edition.id,
      },
    });
  }

  const counts = DEMO_SPONSORS.reduce<Record<string, number>>((acc, s) => {
    acc[s.level] = (acc[s.level] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Sponsors created: ${DEMO_SPONSORS.length} ` +
      `(${counts.PLATINUM} platinum, ${counts.GOLD} gold, ${counts.SOUTIEN} soutien)`,
  );

  // The featured speaker below works for a sponsor, which exercises the
  // speaker↔sponsor link (RG-204/RG-226) — her company must match its name.
  const sponsorOfMarie = await prisma.sponsor.findFirstOrThrow({
    where: { editionId: edition.id, slug: "capgemini-sud" },
  });

  const speakerMarie = await prisma.speaker.create({
    data: {
      slug: "marie-dupont", name: "Marie Dupont", company: sponsorOfMarie.name, city: "Toulouse",
      bioFr: "Ingénieure cloud passionnée de Kubernetes.", bioEn: "Cloud engineer passionate about Kubernetes.",
      isFeatured: true, publicationStatus: "PUBLISHED", editionId: edition.id, sponsorId: sponsorOfMarie.id,
      socialLinks: JSON.stringify({ github: "https://github.com/example", linkedin: "https://linkedin.com/in/example" }),
    },
  });
  const speakerJean = await prisma.speaker.create({
    data: {
      slug: "jean-martin", name: "Jean Martin", company: "Freelance", city: "Bordeaux",
      bioFr: "Développeur web fullstack.", bioEn: "Fullstack web developer.",
      isFeatured: true, publicationStatus: "PUBLISHED", editionId: edition.id,
    },
  });
  await prisma.speaker.create({
    data: {
      slug: "sophie-bernard", name: "Sophie Bernard", company: "Google", city: "Paris",
      bioFr: "Developer advocate.", bioEn: "Developer advocate.",
      publicationStatus: "DRAFT", editionId: edition.id,
    },
  });
  console.log("Speakers created: 3");

  await prisma.talk.create({
    data: {
      slug: "kubernetes-en-production", titleFr: "Kubernetes en production", titleEn: "Kubernetes in production",
      descriptionFr: "Retour d'expérience sur l'exploitation de Kubernetes à grande échelle.",
      descriptionEn: "Lessons learned running Kubernetes at scale.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr",
      publicationStatus: "PUBLISHED", editionId: edition.id, categoryId: catCloud.id,
      speakers: { connect: [{ id: speakerMarie.id }] },
    },
  });
  await prisma.talk.create({
    data: {
      slug: "react-server-components", titleFr: "React Server Components", titleEn: "React Server Components",
      descriptionFr: "Comprendre les Server Components et leur impact.",
      descriptionEn: "Understanding Server Components and their impact.",
      format: "QUICKIE", level: "INTERMEDIAIRE", language: "fr",
      publicationStatus: "PUBLISHED", editionId: edition.id, categoryId: catWeb.id,
      speakers: { connect: [{ id: speakerJean.id }] },
    },
  });
  console.log("Talks created: 2");

  // --- Social Links ---
  const socialSettings = [
    { key: "social_linkedin", value: "https://www.linkedin.com/company/gdg-toulouse/" },
    { key: "social_youtube", value: "https://www.youtube.com/@GDGToulouse" },
    { key: "social_x", value: "https://x.com/DevFestToulouse" },
    { key: "social_bluesky", value: "https://bsky.app/profile/devfesttoulouse.fr" },
  ];
  for (const entry of socialSettings) {
    await prisma.siteSetting.upsert({
      where: { key: entry.key },
      update: {},
      create: entry,
    });
  }
  console.log(`Social links created: ${socialSettings.length}`);

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
