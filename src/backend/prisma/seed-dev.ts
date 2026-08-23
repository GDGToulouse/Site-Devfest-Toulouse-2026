import { seedBase, prisma, auth } from "./seed.js";
import {
  describeRoomClash,
  findRoomClash,
  type RoomOccupation,
} from "../src/lib/room-clash.js";

// Dev-only test accounts — see docs/comptes-dev-local.md
const DEV_ACCOUNTS = [
  { name: "Admin DevFest", email: "admin@devfesttoulouse.fr", password: "admin1234!dev", role: "ADMIN" as const },
  { name: "Editor DevFest", email: "editor@devfesttoulouse.fr", password: "editor1234!dev", role: "EDITOR" as const },
];

/**
 * Refuses to leave two sessions overlapping in one room (#462).
 *
 * The day is placed from three lists written independently — `sessions`,
 * `placements` and `keynotes` — and nothing compares them, which is how a
 * conference once landed on the exact range another already held in the
 * Amphitheatre. The database is the only place the three meet, so the check
 * belongs here, after all of them have run.
 *
 * Two sessions *following* each other in a room is the nominal 2026 shape —
 * two 20-minute quickies inside a 40-minute slot — and must pass. Only a real
 * overlap is a mistake, and it stops the seed rather than producing a day that
 * cannot happen.
 *
 * A relay room counts as occupied: a keynote on a screen there still fills it.
 */
async function assertNoRoomClash(editionId: number) {
  const placed = await prisma.talk.findMany({
    where: { editionId, startsAt: { not: null }, endsAt: { not: null } },
    select: {
      slug: true,
      roomId: true,
      roomLabel: true,
      startsAt: true,
      endsAt: true,
      simulcasts: { select: { roomId: true, roomLabel: true } },
    },
  });

  const occupations: RoomOccupation[] = placed.flatMap((talk) =>
    [{ roomId: talk.roomId, roomLabel: talk.roomLabel }, ...talk.simulcasts].flatMap(
      ({ roomId, roomLabel }) =>
        roomId == null
          ? []
          : [
              {
                slug: talk.slug,
                room: roomLabel ?? `#${roomId}`,
                roomId,
                start: talk.startsAt!,
                end: talk.endsAt!,
              },
            ],
    ),
  );

  const clash = findRoomClash(occupations);
  if (clash) throw new Error(`Seed inconsistency in ${describeRoomClash(clash)}`);
}

async function seedDev() {
  // Run base seed first (contact categories, admin accounts)
  await seedBase();

  console.log("Seeding dev data...");

  // --- Venues (#105) ---
  // Upsert by name: the venue is the shared entity, so re-seeding must find the
  // existing row rather than fail on the unique name.
  //
  // `update` carries the same fields as `create` (#452). With an empty update,
  // the row the #105 migration had backfilled from `Edition.venueName` — with
  // no coordinates, because the local edition had none — was never repaired:
  // `hasVenueInfo` stayed false, /fr/lieu answered 404 and the "Lieu" menu
  // entry never appeared. A dev seed has to converge on the state it describes,
  // or "replay the seed" stops meaning anything.
  const diagoraFields = { address: "Labège", lat: 43.5497, lng: 1.5119 };
  const diagora = await prisma.venue.upsert({
    where: { name: "Diagora" },
    update: diagoraFields,
    create: { name: "Diagora", ...diagoraFields },
  });

  // The eight rooms of the 2026 edition, with their real capacities — the
  // schedule grid orders its columns by sortOrder.
  const rooms2026 = [
    { name: "Amphithéâtre", capacity: 500, sortOrder: 1 },
    { name: "Agora 1", capacity: 500, sortOrder: 2 },
    { name: "Hémicycle", capacity: 150, sortOrder: 3 },
    { name: "Pastel", capacity: 200, sortOrder: 4 },
    { name: "Lauragais", capacity: 200, sortOrder: 5 },
    { name: "Ellipse", capacity: 100, sortOrder: 6 },
    { name: "Salle Quickies", capacity: 80, sortOrder: 7 },
    { name: "Salle Communautés", capacity: 80, sortOrder: 8 },
  ];
  for (const room of rooms2026) {
    await prisma.room.upsert({
      where: { venueId_name: { venueId: diagora.id, name: room.name } },
      update: { capacity: room.capacity, sortOrder: room.sortOrder },
      create: { ...room, venueId: diagora.id },
    });
  }
  console.log(`Venue created: ${diagora.name} (${rooms2026.length} rooms)`);

  const pierreBaudis = await prisma.venue.upsert({
    where: { name: "Centre de Congrès Pierre Baudis" },
    update: { address: "Toulouse" },
    create: { name: "Centre de Congrès Pierre Baudis", address: "Toulouse" },
  });

  // --- Edition 2026 ---
  const edition = await prisma.edition.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      startDate: new Date("2026-11-19T09:00:00Z"),
      endDate: new Date("2026-11-19T18:00:00Z"),
      status: "ANNOUNCEMENT",
      venueId: diagora.id,
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
      venueId: pierreBaudis.id,
      aftermovieUrl: "https://www.youtube.com/watch?v=nCjk1T8G1WE",
      galleryUrl: "https://photos.app.goo.gl/devfest2025",
      archivedSiteUrl: "https://2025.devfesttoulouse.fr",
    },
    create: {
      year: 2025,
      startDate: new Date("2025-11-06T09:00:00Z"),
      endDate: new Date("2025-11-06T18:00:00Z"),
      status: "SEE_YOU_NEXT_YEAR",
      venueId: pierreBaudis.id,
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

  // --- Sponsor tier catalogue (#317) ---
  // The catalogue is global (shared across editions), so it is upserted by key
  // rather than wiped. Each tier carries its display attributes (colour, logo
  // scale), its job-offer quota and whether it may fill promo ideas.
  const TIER_CATALOG = [
    {
      key: "platinum", nameFr: "Platinum", nameEn: "Platinum",
      subtitleFr: "Au dessus de la mêlée !", subtitleEn: "Above the pack!",
      descriptionFr: "La visibilité la plus complète avec un grand stand pour vous mettre en avant.",
      descriptionEn: "The most comprehensive visibility with a large booth to showcase your brand.",
      standSize: "12m²",
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
      color: "#109E6E", logoScale: 1.0, rank: 40, jobOfferQuota: 4, allowsPromoIdeas: true,
    },
    {
      key: "gold", nameFr: "Gold", nameEn: "Gold",
      subtitleFr: "Le Best-seller", subtitleEn: "The Best-seller",
      descriptionFr: "Le stand idéal pour être au contact des participants et promouvoir votre marque.",
      descriptionEn: "The ideal booth to connect with attendees and promote your brand.",
      standSize: "6m²",
      advantages: JSON.stringify([
        { fr: "Stand de 6m²", en: "6m² booth" },
        { fr: "Logo sur le site web", en: "Logo on the website" },
        { fr: "Mention sur les réseaux sociaux", en: "Social media mention" },
        { fr: "Billets inclus pour votre équipe", en: "Included tickets for your team" },
        { fr: "Logo sur les supports de communication", en: "Logo on communication materials" },
        { fr: "Roll-up sur le stand", en: "Roll-up at the booth" },
      ]),
      color: "#FFD428", logoScale: 0.8, rank: 30, jobOfferQuota: 2, allowsPromoIdeas: false,
    },
    {
      key: "discovery", nameFr: "Discovery", nameEn: "Discovery",
      subtitleFr: "Un coup de pouce aux PME", subtitleEn: "A boost for SMEs",
      descriptionFr: "Un format accessible pour les PME souhaitant se faire connaître auprès de la communauté tech.",
      descriptionEn: "An accessible format for SMEs wanting to get known in the tech community.",
      standSize: "2m²",
      advantages: JSON.stringify([
        { fr: "Stand de 2m²", en: "2m² booth" },
        { fr: "Logo sur le site web", en: "Logo on the website" },
        { fr: "Mention sur les réseaux sociaux", en: "Social media mention" },
        { fr: "Billets inclus", en: "Included tickets" },
      ]),
      color: "#EE7CAD", logoScale: 0.6, rank: 20, jobOfferQuota: 1, allowsPromoIdeas: false,
    },
    {
      key: "soutien-communautes", nameFr: "Soutien et Communautés", nameEn: "Support & Communities",
      subtitleFr: "Visibilité numérique", subtitleEn: "Digital visibility",
      descriptionFr: "Associez votre marque à l'événement sans avoir à gérer un stand physique.",
      descriptionEn: "Associate your brand with the event without managing a physical booth.",
      standSize: null,
      advantages: JSON.stringify([
        { fr: "Logo sur le site web", en: "Logo on the website" },
        { fr: "Mention sur les réseaux sociaux", en: "Social media mention" },
        { fr: "Billets inclus", en: "Included tickets" },
        { fr: "Visibilité sur les écrans de l'événement", en: "Visibility on event screens" },
      ]),
      color: "#507BBD", logoScale: 0.5, rank: 10, jobOfferQuota: 1, allowsPromoIdeas: false,
    },
  ];
  // Display attributes kept alongside the id: participations freeze them (#375).
  const sponsorTiers: Record<
    string,
    { id: number; nameFr: string; nameEn: string; color: string; logoScale: number }
  > = {};
  for (const t of TIER_CATALOG) {
    sponsorTiers[t.key] = await prisma.sponsorTier.upsert({
      where: { key: t.key },
      update: t,
      create: t,
    });
  }
  console.log(`Sponsor tiers upserted: ${TIER_CATALOG.length}`);

  // --- Which tiers this edition proposes (#317) ---
  const EDITION_TIERS = [
    { key: "platinum", sortOrder: 1 },
    { key: "gold", sortOrder: 2 },
    { key: "discovery", sortOrder: 3 },
    { key: "soutien-communautes", sortOrder: 4 },
  ];
  for (const et of EDITION_TIERS) {
    await prisma.editionSponsorTier.upsert({
      where: { editionId_tierId: { editionId: edition.id, tierId: sponsorTiers[et.key].id } },
      update: { isVisible: true, price: null, sortOrder: et.sortOrder },
      create: { editionId: edition.id, tierId: sponsorTiers[et.key].id, isVisible: true, price: null, sortOrder: et.sortOrder },
    });
  }
  console.log(`Edition sponsor tiers created: ${EDITION_TIERS.length}`);

  // --- Lot 2: Categories, Sponsors, Speakers, Talks (dev sample data) ---
  // Wipe in dependency order so re-running the dev seed is idempotent.
  await prisma.talk.deleteMany({ where: { editionId: edition.id } });
  // Speakers are people since #351, shared across editions like categories
  // below: deleting them would wipe identities other editions still point at.
  // Only this edition's participations go; the identities are upserted by slug.
  await prisma.speakerEdition.deleteMany({ where: { editionId: edition.id } });
  // Sponsors are companies since #129, shared across editions like speakers
  // above: deleting the identity would cascade-delete its participations in
  // OTHER editions too. Only this edition's participation goes; the identity
  // is upserted by slug.
  await prisma.editionSponsor.deleteMany({ where: { editionId: edition.id } });
  // Categories are shared across editions since #338, so they are upserted by
  // name and merely re-bound to this edition rather than wiped and recreated —
  // deleting them would take other editions' bindings down with them.
  await prisma.editionCategory.deleteMany({ where: { editionId: edition.id } });

  const catCloud = await prisma.category.upsert({
    where: { nameFr: "Cloud & DevOps" },
    update: { nameEn: "Cloud & DevOps", color: "#509EE3" },
    create: { nameFr: "Cloud & DevOps", nameEn: "Cloud & DevOps", color: "#509EE3" },
  });
  const catWeb = await prisma.category.upsert({
    where: { nameFr: "Web & Mobile" },
    update: { nameEn: "Web & Mobile", color: "#EC6839" },
    create: { nameFr: "Web & Mobile", nameEn: "Web & Mobile", color: "#EC6839" },
  });
  // Two categories alternating session by session said nothing about what a
  // real grid renders (#460): not the chip row wrapping, not two colour dots
  // side by side on a card, not a category filter that actually empties the
  // grid. Colours come from the palette in `docs/design-system.md`.
  const catData = await prisma.category.upsert({
    where: { nameFr: "IA & Data" },
    update: { nameEn: "AI & Data", color: "#109E6E" },
    create: { nameFr: "IA & Data", nameEn: "AI & Data", color: "#109E6E" },
  });
  const catCraft = await prisma.category.upsert({
    where: { nameFr: "Craft & Architecture" },
    update: { nameEn: "Craft & Architecture", color: "#F8AB06" },
    create: { nameFr: "Craft & Architecture", nameEn: "Craft & Architecture", color: "#F8AB06" },
  });
  const catSecu = await prisma.category.upsert({
    where: { nameFr: "Sécurité" },
    update: { nameEn: "Security", color: "#B94420" },
    create: { nameFr: "Sécurité", nameEn: "Security", color: "#B94420" },
  });
  await prisma.editionCategory.createMany({
    data: [
      { editionId: edition.id, categoryId: catCloud.id, sortOrder: 0 },
      { editionId: edition.id, categoryId: catWeb.id, sortOrder: 1 },
      { editionId: edition.id, categoryId: catData.id, sortOrder: 2 },
      { editionId: edition.id, categoryId: catCraft.id, sortOrder: 3 },
      { editionId: edition.id, categoryId: catSecu.id, sortOrder: 4 },
    ],
    skipDuplicates: true,
  });
  console.log("Categories created: 5");

  // A realistic sponsor wall: 4 Platinum, 16 Gold, 8 Soutien. Every field is
  // filled (logo, both descriptions, website, socials, contact email) so the
  // public pages and the admin forms can be exercised for real. Logos are
  // placeholder SVGs under public/images/sponsors/ — see the slugs below.
  // Every company here is FICTIONAL on purpose: demo data must never suggest
  // that a real firm sponsors the event.
  const DEMO_SPONSORS: Array<{
    slug: string;
    name: string;
    level: "PLATINUM" | "GOLD" | "SOUTIEN";
    descriptionFr: string;
    descriptionEn: string;
    websiteUrl: string;
  }> = [
    { slug: "aeronova-systems", name: "AeroNova Systems", level: "PLATINUM",
      descriptionFr: "Logiciel embarqué et cloud souverain pour l'aéronautique. Nos équipes conçoivent les systèmes critiques qui volent chaque jour.",
      descriptionEn: "Embedded software and sovereign cloud for aerospace. Our teams build the critical systems that fly every day.",
      websiteUrl: "https://example.com/aeronova-systems" },
    { slug: "garonne-digital", name: "Garonne Digital", level: "PLATINUM",
      descriptionFr: "Conseil et ingénierie logicielle en Occitanie. Nous accompagnons la transformation numérique des grands comptes régionaux.",
      descriptionEn: "Consulting and software engineering in Occitanie. We drive the digital transformation of major regional accounts.",
      websiteUrl: "https://example.com/garonne-digital" },
    { slug: "violette-cloud", name: "Violette Cloud", level: "PLATINUM",
      descriptionFr: "Hébergeur et intégrateur de services numériques. Réseaux, cybersécurité et plateformes de données pour les entreprises.",
      descriptionEn: "Hosting provider and digital services integrator. Networks, cybersecurity and data platforms for businesses.",
      websiteUrl: "https://example.com/violette-cloud" },
    { slug: "meridien-tech", name: "Méridien Tech", level: "PLATINUM",
      descriptionFr: "Technologies de confiance pour le spatial, la défense et le transport. R&D logicielle basée à Toulouse.",
      descriptionEn: "Trusted technologies for space, defence and transport. Software R&D based in Toulouse.",
      websiteUrl: "https://example.com/meridien-tech" },

    { slug: "cassoulet-code", name: "Cassoulet Code", level: "GOLD",
      descriptionFr: "ESN régionale, forte présence à Toulouse sur les projets aéronautiques et bancaires.",
      descriptionEn: "Regional IT services firm with a strong Toulouse presence in aerospace and banking projects.",
      websiteUrl: "https://example.com/cassoulet-code" },
    { slug: "pyrene-labs", name: "Pyrène Labs", level: "GOLD",
      descriptionFr: "Cloud, cybersécurité et calcul haute performance au service des acteurs régionaux.",
      descriptionEn: "Cloud, cybersecurity and high-performance computing for regional players.",
      websiteUrl: "https://example.com/pyrene-labs" },
    { slug: "occitania-data", name: "Occitania Data", level: "GOLD",
      descriptionFr: "Conseil en management et intégration de systèmes, avec une practice Data & IA locale.",
      descriptionEn: "Management consulting and systems integration, with a local Data & AI practice.",
      websiteUrl: "https://example.com/occitania-data" },
    { slug: "brique-rouge-soft", name: "Brique Rouge Software", level: "GOLD",
      descriptionFr: "Ingénierie et conseil en technologies, spécialiste des systèmes embarqués.",
      descriptionEn: "Engineering and technology consulting, specialised in embedded systems.",
      websiteUrl: "https://example.com/brique-rouge-soft" },
    { slug: "canal-midi-tech", name: "Canal Midi Tech", level: "GOLD",
      descriptionFr: "Ingénierie de la R&D externalisée pour l'industrie aéronautique et spatiale.",
      descriptionEn: "Outsourced R&D engineering for the aerospace industry.",
      websiteUrl: "https://example.com/canal-midi-tech" },
    { slug: "capitole-consulting", name: "Capitole Consulting", level: "GOLD",
      descriptionFr: "Systèmes numériques critiques, qualité et performance opérationnelle.",
      descriptionEn: "Critical digital systems, quality and operational performance.",
      websiteUrl: "https://example.com/capitole-consulting" },
    { slug: "stellaris-engineering", name: "Stellaris Engineering", level: "GOLD",
      descriptionFr: "Ingénierie, qualité et conseil en transformation, du prototype à la série.",
      descriptionEn: "Engineering, quality and transformation consulting, from prototype to production.",
      websiteUrl: "https://example.com/stellaris-engineering" },
    { slug: "pixel-garonne", name: "Pixel Garonne", level: "GOLD",
      descriptionFr: "Cabinet de conseil et agence digitale : produit, design et développement.",
      descriptionEn: "Consulting firm and digital agency: product, design and development.",
      websiteUrl: "https://example.com/pixel-garonne" },
    { slug: "helios-partners", name: "Helios Partners", level: "GOLD",
      descriptionFr: "Architecte des grandes transformations, du conseil à la mise en œuvre.",
      descriptionEn: "Architect of large-scale transformations, from advice to delivery.",
      websiteUrl: "https://example.com/helios-partners" },
    { slug: "nimbus-sud", name: "Nimbus Sud", level: "GOLD",
      descriptionFr: "Cloud, data et cybersécurité. Partenaire des principaux hyperscalers.",
      descriptionEn: "Cloud, data and cybersecurity. Partner of the major hyperscalers.",
      websiteUrl: "https://example.com/nimbus-sud" },
    { slug: "forge-numerique", name: "Forge Numérique", level: "GOLD",
      descriptionFr: "Cabinet de conseil et de développement : craft, cloud et data engineering.",
      descriptionEn: "Consulting and development firm: software craft, cloud and data engineering.",
      websiteUrl: "https://example.com/forge-numerique" },
    { slug: "libreband", name: "LibreBand", level: "GOLD",
      descriptionFr: "Conseil, réalisation et formation autour des technologies open source.",
      descriptionEn: "Consulting, delivery and training around open source technologies.",
      websiteUrl: "https://example.com/libreband" },
    { slug: "kernel-panic-corp", name: "Kernel Panic Corp", level: "GOLD",
      descriptionFr: "Architecture, agilité et culture produit — il y a toujours une meilleure façon de faire.",
      descriptionEn: "Architecture, agility and product culture — there is always a better way.",
      websiteUrl: "https://example.com/kernel-panic-corp" },
    { slug: "serverless-sud", name: "Serverless Sud", level: "GOLD",
      descriptionFr: "Experts serverless et plateformes cloud natives, du POC à la production.",
      descriptionEn: "Serverless and cloud-native platform experts, from PoC to production.",
      websiteUrl: "https://example.com/serverless-sud" },
    { slug: "atelier-du-code", name: "Atelier du Code", level: "GOLD",
      descriptionFr: "Collectif d'artisans du logiciel, attaché à la qualité et à l'humain.",
      descriptionEn: "A collective of software craftspeople, committed to quality and to people.",
      websiteUrl: "https://example.com/atelier-du-code" },
    { slug: "boussole-it", name: "Boussole IT", level: "GOLD",
      descriptionFr: "Amélioration continue appliquée aux systèmes d'information.",
      descriptionEn: "Continuous improvement applied to information systems.",
      websiteUrl: "https://example.com/boussole-it" },

    { slug: "melee-fictive", name: "La Mêlée Fictive", level: "SOUTIEN",
      descriptionFr: "Association qui fédère l'écosystème numérique régional depuis plus de vingt ans.",
      descriptionEn: "The association bringing together the regional digital ecosystem for over twenty years.",
      websiteUrl: "https://example.com/melee-fictive" },
    { slug: "rose-tech-hub", name: "Rose Tech Hub", level: "SOUTIEN",
      descriptionFr: "Point de rencontre des startups et des talents tech du bassin toulousain.",
      descriptionEn: "Meeting point for the startups and tech talent of the Toulouse area.",
      websiteUrl: "https://example.com/rose-tech-hub" },
    { slug: "cluster-sud-ouest", name: "Cluster Sud-Ouest", level: "SOUTIEN",
      descriptionFr: "Cluster fictif des entreprises du numérique en Occitanie.",
      descriptionEn: "Fictional cluster of digital companies in Occitanie.",
      websiteUrl: "https://example.com/cluster-sud-ouest" },
    { slug: "cowork-cassoulet", name: "Cowork Cassoulet", level: "SOUTIEN",
      descriptionFr: "Espaces de coworking au cœur de Toulouse, ouverts aux communautés tech.",
      descriptionEn: "Coworking spaces in the heart of Toulouse, open to tech communities.",
      websiteUrl: "https://example.com/cowork-cassoulet" },
    { slug: "studio-pastel", name: "Studio Pastel", level: "SOUTIEN",
      descriptionFr: "Studio de création graphique et d'illustration, partenaire visuel de l'événement.",
      descriptionEn: "Graphic design and illustration studio, the event's visual partner.",
      websiteUrl: "https://example.com/studio-pastel" },
    { slug: "tiers-lieu-violette", name: "Tiers-Lieu Violette", level: "SOUTIEN",
      descriptionFr: "Tiers-lieu dédié à l'innovation et à l'entrepreneuriat.",
      descriptionEn: "A third place dedicated to innovation and entrepreneurship.",
      websiteUrl: "https://example.com/tiers-lieu-violette" },
    { slug: "cafe-et-commit", name: "Café & Commit", level: "SOUTIEN",
      descriptionFr: "Torréfacteur local qui réveille les développeurs depuis 2016.",
      descriptionEn: "The local coffee roaster that has been waking developers up since 2016.",
      websiteUrl: "https://example.com/cafe-et-commit" },
    { slug: "labo-ouvert", name: "Labo Ouvert", level: "SOUTIEN",
      descriptionFr: "Laboratoire d'innovation ouverte, incubateur de projets communautaires.",
      descriptionEn: "Open innovation lab, incubator of community projects.",
      websiteUrl: "https://example.com/labo-ouvert" },
  ];

  // Map the demo levels onto the tier catalogue seeded above (#317).
  const DEMO_LEVEL_TO_TIER: Record<"PLATINUM" | "GOLD" | "SOUTIEN", string> = {
    PLATINUM: "platinum",
    GOLD: "gold",
    SOUTIEN: "soutien-communautes",
  };

  for (const s of DEMO_SPONSORS) {
    // Upserted by slug, with the participation upserted separately (#129): the
    // identity may already exist from another edition, only the participation
    // is this year's — mirrors the speaker identity/participation split above.
    const sponsor = await prisma.sponsor.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
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
      },
      create: {
        slug: s.slug,
        name: s.name,
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
      },
    });

    // Freeze what this edition displays (#375), like the admin does on create:
    // the demo data then exercises the archive path rather than the fallback.
    const tier = sponsorTiers[DEMO_LEVEL_TO_TIER[s.level]];
    const frozen = {
      logoUrl: `/images/sponsors/${s.slug}.svg`,
      tierId: tier.id,
      tierNameFr: tier.nameFr,
      tierNameEn: tier.nameEn,
      tierColor: tier.color,
      tierLogoScale: tier.logoScale,
      publicationStatus: "PUBLISHED" as const,
    };
    await prisma.editionSponsor.upsert({
      where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId: edition.id } },
      update: frozen,
      create: { sponsorId: sponsor.id, editionId: edition.id, ...frozen },
    });
  }

  // --- 2025 participations: the archive path (#370, #375) ---
  //
  // Without these, no sponsor has ever taken part in a past edition, so three
  // behaviours stay untested in dev: the sponsors section of a past edition
  // page, the per-edition freeze, and the year filter of the admin list — which
  // only breaks once a company spans two years (#395).
  //
  // The frozen values are deliberately DIFFERENT from 2026: same company, other
  // logo, other tier label. Seeding a copy of 2026 would look right while
  // proving nothing — a page reading through to the live values would render
  // identically.
  const DEMO_SPONSORS_2025: { slug: string; level: "PLATINUM" | "GOLD" | "SOUTIEN" }[] = [
    // Stayed on, same tier: the plain case.
    { slug: "aeronova-systems", level: "PLATINUM" },
    // Moved up between the two years — the sponsor wall must show Gold in 2025
    // and Platinum in 2026.
    { slug: "garonne-digital", level: "GOLD" },
    // Moved down, the other direction.
    { slug: "occitania-data", level: "PLATINUM" },
    { slug: "pyrene-labs", level: "GOLD" },
    // Two more spanning both years, so the admin year filter has enough rows to
    // fail on visibly (#395) rather than a single edge case.
    { slug: "cafe-et-commit", level: "SOUTIEN" },
    { slug: "labo-ouvert", level: "SOUTIEN" },
  ];

  // One company sponsored 2025 and did NOT come back: its 2026 participation is
  // dropped right after being seeded above, leaving the identity reachable only
  // through 2025. That is the case which catches a page listing sponsors from
  // the identity table instead of the participations — it would appear on the
  // 2026 wall, where it no longer belongs. Reusing a seeded company rather than
  // inventing one keeps its logo file real.
  const GONE_SLUG = "cluster-sud-ouest";
  await prisma.editionSponsor.deleteMany({
    where: { editionId: edition.id, sponsor: { slug: GONE_SLUG } },
  });
  DEMO_SPONSORS_2025.push({ slug: GONE_SLUG, level: "GOLD" });

  // Upserted, not deleted first: the purge above is scoped to the current
  // edition on purpose, so 2025 rows survive a reseed and this loop refreshes
  // them in place. The identity is looked up rather than created — these
  // companies are seeded for 2026 just above.
  for (const s of DEMO_SPONSORS_2025) {
    const sponsor = await prisma.sponsor.findUnique({ where: { slug: s.slug }, select: { id: true } });
    if (!sponsor) continue;

    const tier = sponsorTiers[DEMO_LEVEL_TO_TIER[s.level]];
    const frozen = {
      // A logo the company no longer uses. Anything reading the identity's
      // current logo instead of the frozen one shows the 2026 file — visible
      // at a glance on /fr/editions/2025.
      logoUrl: `/images/sponsors/${s.slug}.svg`,
      tierId: tier.id,
      // Year-stamped labels: a page rendering "Platinum" on the 2025 wall is
      // reading the live catalogue, which #375 exists to prevent.
      tierNameFr: `${tier.nameFr} 2025`,
      tierNameEn: `${tier.nameEn} 2025`,
      tierColor: tier.color,
      tierLogoScale: tier.logoScale,
      publicationStatus: "PUBLISHED" as const,
    };
    await prisma.editionSponsor.upsert({
      where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId: edition2025.id } },
      update: frozen,
      create: { sponsorId: sponsor.id, editionId: edition2025.id, ...frozen },
    });
  }
  console.log(`Sponsors linked to 2025: ${DEMO_SPONSORS_2025.length} (frozen tier labels)`);

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
    where: { slug: "garonne-digital" },
  });

  // Upserted by slug, with the participation nested (#351): the identity may
  // already exist from another edition, only the participation is this year's.
  const speakerMarie = await prisma.speaker.upsert({
    where: { slug: "marie-dupont" },
    update: { company: sponsorOfMarie.name },
    create: {
      slug: "marie-dupont", name: "Marie Dupont", company: sponsorOfMarie.name, city: "Toulouse",
      bioFr: "Ingénieure cloud passionnée de Kubernetes.", bioEn: "Cloud engineer passionate about Kubernetes.",
      socialLinks: JSON.stringify({ github: "https://github.com/example", linkedin: "https://linkedin.com/in/example" }),
    },
  });
  const speakerJean = await prisma.speaker.upsert({
    where: { slug: "jean-martin" },
    update: {},
    create: {
      slug: "jean-martin", name: "Jean Martin", company: "Freelance", city: "Bordeaux",
      bioFr: "Développeur web fullstack.", bioEn: "Fullstack web developer.",
    },
  });
  const speakerSophie = await prisma.speaker.upsert({
    where: { slug: "sophie-bernard" },
    update: {},
    create: {
      slug: "sophie-bernard", name: "Sophie Bernard", company: "Google", city: "Paris",
      bioFr: "Developer advocate.", bioEn: "Developer advocate.",
    },
  });
  // Two more, so a session can be given by several people (#463). Every talk in
  // the demo day had exactly one speaker, so the grid card was never asked to
  // draw a second bubble, let alone fold a fourth into +N.
  const speakerLina = await prisma.speaker.upsert({
    where: { slug: "lina-oueslati" },
    update: {},
    create: {
      slug: "lina-oueslati", name: "Lina Oueslati", company: "Nimbus Sud", city: "Montpellier",
      bioFr: "Ingénieure plateforme, spécialiste de l'observabilité.",
      bioEn: "Platform engineer, focused on observability.",
    },
  });
  const speakerOmar = await prisma.speaker.upsert({
    where: { slug: "omar-benali" },
    update: {},
    create: {
      slug: "omar-benali", name: "Omar Benali", company: "Freelance", city: "Toulouse",
      bioFr: "Développeur TypeScript et formateur.",
      bioEn: "TypeScript developer and trainer.",
    },
  });
  const speakerThea = await prisma.speaker.upsert({
    where: { slug: "thea-nguyen" },
    update: {},
    create: {
      slug: "thea-nguyen", name: "Théa Nguyen", company: "Cassoulet Code", city: "Toulouse",
      bioFr: "Développeuse front, autrice d'un cours de TypeScript.",
      bioEn: "Frontend developer, author of a TypeScript course.",
    },
  });

  // The sponsor association rides on the participation since #353 — it is true
  // of a given year, and Sponsor is edition-scoped too.
  for (const [speakerId, isFeatured, publicationStatus, sponsorId] of [
    [speakerMarie.id, true, "PUBLISHED", sponsorOfMarie.id],
    [speakerJean.id, true, "PUBLISHED", null],
    [speakerSophie.id, false, "DRAFT", null],
    // Published, or the bubble on their card would link to a 404 (#463).
    [speakerLina.id, false, "PUBLISHED", null],
    [speakerOmar.id, false, "PUBLISHED", null],
    [speakerThea.id, false, "PUBLISHED", null],
  ] as const) {
    await prisma.speakerEdition.upsert({
      where: { speakerId_editionId: { speakerId, editionId: edition.id } },
      update: { isFeatured, publicationStatus, sponsorId },
      create: { speakerId, editionId: edition.id, isFeatured, publicationStatus, sponsorId },
    });
  }
  console.log("Speakers created: 6");

  await prisma.talk.create({
    data: {
      slug: "kubernetes-en-production", title: "Kubernetes en production",
      description: "Retour d'expérience sur l'exploitation de Kubernetes à grande échelle.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr",
      // Speaker editing opened on this one only (#289), so both states are
      // testable from a single dev speaker link.
      isSpeakerEditable: true,
      publicationStatus: "PUBLISHED", editionId: edition.id, categoryId: catCloud.id,
      speakers: { connect: [{ id: speakerMarie.id }] },
    },
  });
  await prisma.talk.create({
    data: {
      // English-language talk (#293): its content stays in English, and the slug
      // keeps the French-derived form it was indexed under.
      slug: "react-server-components", title: "React Server Components in practice",
      description: "Understanding Server Components and their impact.",
      format: "QUICKIE", level: "INTERMEDIAIRE", language: "en",
      publicationStatus: "PUBLISHED", editionId: edition.id, categoryId: catWeb.id,
      speakers: { connect: [{ id: speakerJean.id }] },
    },
  });
  // --- Schedule (#105, rendered by #106) ---
  //
  // A day dense enough for the grid to be worth looking at: six session slots
  // across four rooms. Diagora holds eight, and four staying empty is the case
  // the endpoint derives its columns for — a venue's room list is not a grid.
  //
  // Times are UTC, an hour behind the November wall clock in Toulouse, and fit
  // between the off-session moments of the 2026 sponsor guide below.
  const sessions = [
    { slug: "observabilite-opentelemetry", title: "Observabilité : OpenTelemetry en pratique",
      description: "Instrumenter une application sans se noyer dans les traces.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr", category: catCloud.id,
      speaker: speakerMarie.id, room: "Amphithéâtre", start: "08:50", end: "09:30" },
    { slug: "design-system-tailwind", title: "Un design system qui survit à ses auteurs",
      description: "Tokens, composants et conventions : ce qui tient dans la durée.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catWeb.id,
      speaker: speakerJean.id, room: "Agora 1", start: "08:50", end: "09:30" },
    { slug: "postgres-plan-execution", title: "Postgres : lire un plan d'exécution",
      description: "EXPLAIN ANALYZE, ligne par ligne, sur des requêtes réelles.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr", category: catData.id,
      speaker: speakerMarie.id, room: "Hémicycle", start: "08:50", end: "09:30" },
    { slug: "accessibilite-par-ou-commencer", title: "Accessibilité : par où commencer",
      description: "Les quelques gestes qui changent tout, avant l'audit complet.",
      format: "QUICKIE", level: "DEBUTANT", language: "fr", category: catWeb.id,
      speaker: speakerJean.id, room: "Pastel", start: "08:50", end: "09:10" },
    { slug: "terraform-sans-douleur", title: "Terraform sans douleur",
      description: "Modules, états partagés et revues : industrialiser sans se figer.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catCloud.id,
      speaker: speakerMarie.id, room: "Amphithéâtre", start: "10:00", end: "10:40" },
    { slug: "server-actions-limites", title: "Server Actions : jusqu'où aller",
      description: "Ce que les Server Actions résolvent, et ce qu'elles compliquent.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr", category: catWeb.id,
      speaker: speakerJean.id, room: "Agora 1", start: "10:00", end: "10:40" },
    { slug: "edge-computing-really-buys", title: "Edge computing: what it actually buys you",
      description: "Measuring the latency you gain, and the complexity you pay.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "en", category: catCloud.id,
      speaker: speakerMarie.id, room: "Hémicycle", start: "10:55", end: "11:35" },
    { slug: "web-components-renouveau", title: "Web Components : le renouveau",
      description: "Les nouvelles API navigateur qui les rendent enfin utilisables.",
      format: "QUICKIE", level: "INTERMEDIAIRE", language: "fr", category: catWeb.id,
      speaker: speakerJean.id, room: "Pastel", start: "10:55", end: "11:15" },
    { slug: "finops-reprendre-la-main", title: "FinOps : reprendre la main sur la facture",
      description: "Attribuer les coûts, puis décider — dans cet ordre.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catCloud.id,
      speaker: speakerMarie.id, room: "Amphithéâtre", start: "13:15", end: "13:55" },
    { slug: "tests-end-to-end-playwright", title: "Tests end-to-end : arrêter de les subir",
      description: "Écrire des tests qui échouent pour une bonne raison seulement.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catCraft.id,
      speaker: speakerJean.id, room: "Agora 1", start: "13:15", end: "13:55" },
    { slug: "vos-secrets-sont-en-clair", title: "Vos secrets sont en clair (et vous l'ignorez)",
      description: "Là où les jetons finissent vraiment : logs, images, tickets.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr", category: catSecu.id,
      speaker: speakerMarie.id, room: "Amphithéâtre", start: "14:10", end: "14:50" },
    { slug: "islands-architecture-production", title: "Islands architecture in production",
      description: "Shipping less JavaScript without giving up interactivity.",
      format: "CONFERENCE", level: "CONFIRME", language: "en", category: catWeb.id,
      speaker: speakerJean.id, room: "Agora 1", start: "14:10", end: "14:50" },
    { slug: "green-it-mesurer-avant", title: "Green IT : mesurer avant d'optimiser",
      description: "Ce qu'on croit économiser, et ce qu'on économise vraiment.",
      format: "CONFERENCE", level: "DEBUTANT", language: "fr", category: catCloud.id,
      speaker: speakerMarie.id, room: "Hémicycle", start: "15:30", end: "16:10" },
    { slug: "typescript-types-avances", title: "TypeScript : les types avancés sans peur",
      description: "Génériques, inférence et types conditionnels, pas à pas.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catCraft.id,
      speaker: speakerJean.id, room: "Agora 1", start: "15:30", end: "16:10" },
    // The four rooms below exist only to fill the grid's remaining columns
    // (#441): with four salles the layout looked fine and hid the fact that a
    // column falls to 130 px at eight. The demo day has to reach eight, or the
    // defect stays invisible in dev.
    { slug: "nix-pour-les-presses", title: "Nix pour les gens pressés",
      description: "Un environnement reproductible sans y passer le trimestre.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr", category: catCloud.id,
      speaker: speakerMarie.id, room: "Lauragais", start: "08:50", end: "09:30" },
    { slug: "rust-cote-serveur", title: "Rust côté serveur : le prix d'entrée",
      description: "Ce qu'on gagne, ce qu'on paie, et quand ça ne vaut pas le coup.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr", category: catCloud.id,
      speaker: speakerMarie.id, room: "Ellipse", start: "08:50", end: "09:30" },
    { slug: "refactoring-en-binome", title: "Refactoring en binôme",
      description: "Quinze minutes pour montrer ce qu'un pas de deux change au code.",
      format: "QUICKIE", level: "DEBUTANT", language: "fr", category: catCraft.id,
      speaker: speakerJean.id, room: "Salle Quickies", start: "08:50", end: "09:10" },
    { slug: "faire-vivre-une-communaute", title: "Faire vivre une communauté locale",
      description: "Ce qui tient une communauté au-delà du premier semestre.",
      format: "CONFERENCE", level: "DEBUTANT", language: "fr", category: catWeb.id,
      speaker: speakerJean.id, room: "Salle Communautés", start: "10:00", end: "10:40" },
    { slug: "sqlite-en-production", title: "SQLite en production, vraiment ?",
      description: "Les cas où c'est le bon choix, et ceux où c'est un piège.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catData.id,
      speaker: speakerMarie.id, room: "Lauragais", start: "10:55", end: "11:35" },
    { slug: "css-moderne-vos-hacks", title: "Le CSS moderne a rattrapé vos hacks",
      description: "Container queries, :has(), subgrid : ce qu'on peut enfin supprimer.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catWeb.id,
      speaker: speakerJean.id, room: "Ellipse", start: "13:15", end: "13:55" },
    { slug: "documenter-sans-y-passer-ses-vendredis", title: "Documenter sans y passer ses vendredis",
      description: "Écrire le strict nécessaire, au moment où ça coûte le moins cher.",
      format: "QUICKIE", level: "DEBUTANT", language: "fr", category: catCraft.id,
      speaker: speakerMarie.id, room: "Salle Quickies", start: "13:15", end: "13:35" },
    { slug: "organiser-un-meetup-qui-dure", title: "Organiser un meetup qui dure",
      description: "Retour sur dix ans de rendez-vous mensuels, sans s'épuiser.",
      format: "CONFERENCE", level: "DEBUTANT", language: "fr", category: catWeb.id,
      speaker: speakerJean.id, room: "Salle Communautés", start: "14:10", end: "14:50" },
    // Two more, so IA & Data and Sécurité each carry a session in the main room
    // rather than only reassigned leftovers (#460). Both land on Amphithéâtre
    // slots that were free, so the empty cells the grid marker needs remain.
    // Agora 1 rather than the Amphithéâtre, which is booked solid: `kubernetes-
    // en-production` already holds it on this range, from the `placements` list
    // below (#462).
    { slug: "llm-en-production", title: "Un LLM en production, et la facture qui va avec",
      description: "Latence, coût au jeton et garde-fous : ce que le prototype ne dit pas.",
      format: "CONFERENCE", level: "INTERMEDIAIRE", language: "fr", category: catData.id,
      speaker: speakerMarie.id, room: "Agora 1", start: "10:55", end: "11:35" },
    // Three quickies that pair up with an existing one, so a room fills the
    // 40 minutes of the conferences beside it in two goes (#462). This is the
    // nominal 2026 shape, and without it in the demo day the grid was never
    // asked to draw a session reaching across two rows.
    //
    // Two quickies are deliberately left on their own — `accessibilite-par-ou-
    // commencer` and `react-server-components`, both in Pastel. The
    // organisation aims for pairs but does not promise them, and a room that
    // frees up halfway has to keep rendering. Both cases now land in the same
    // row: at 09:10 the Salle Quickies is busy and Pastel is genuinely free.
    { slug: "revue-de-code-sans-drame", title: "La revue de code sans drame",
      description: "Ce qu'on écrit dans un commentaire, et ce qui se dit de vive voix.",
      format: "QUICKIE", level: "DEBUTANT", language: "fr", category: catCraft.id,
      speaker: speakerJean.id, room: "Salle Quickies", start: "09:10", end: "09:30" },
    { slug: "feature-flags-vingt-minutes", title: "Les feature flags en vingt minutes",
      description: "Livrer sans déployer, et surtout : retirer le drapeau ensuite.",
      format: "QUICKIE", level: "INTERMEDIAIRE", language: "fr", category: catCloud.id,
      speaker: speakerMarie.id, room: "Pastel", start: "11:15", end: "11:35" },
    { slug: "audit-de-dependances", title: "Auditer ses dépendances sans y passer la semaine",
      description: "Trier ce qui est exploitable de ce qui encombre le rapport.",
      format: "QUICKIE", level: "DEBUTANT", language: "fr", category: catSecu.id,
      speaker: speakerJean.id, room: "Salle Quickies", start: "13:35", end: "13:55" },
    { slug: "chaine-appro-logicielle", title: "Votre chaîne d'approvisionnement logicielle",
      description: "Dépendances, artefacts et signatures : par où un audit commence.",
      format: "CONFERENCE", level: "CONFIRME", language: "fr", category: catSecu.id,
      speaker: speakerJean.id, room: "Amphithéâtre", start: "15:30", end: "16:10" },
  ] as const;

  // Co-speakers (#463): one session given by two, one by four. Three faces fit
  // a 180 px column and the fourth folds into +N — a shape the grid could not
  // be looked at until the demo day contained it.
  const coSpeakers: Record<string, readonly number[]> = {
    "observabilite-opentelemetry": [speakerLina.id],
    "typescript-types-avances": [speakerLina.id, speakerOmar.id, speakerThea.id],
  };

  const roomsByName = new Map(
    (await prisma.room.findMany({ where: { venueId: diagora.id } })).map((r) => [r.name, r]),
  );
  const placedAt = (time: string) => new Date(`2026-11-19T${time}:00Z`);

  for (const session of sessions) {
    const room = roomsByName.get(session.room);
    await prisma.talk.create({
      data: {
        slug: session.slug, title: session.title, description: session.description,
        format: session.format, level: session.level, language: session.language,
        publicationStatus: "PUBLISHED", editionId: edition.id, categoryId: session.category,
        speakers: {
          connect: [session.speaker, ...(coSpeakers[session.slug] ?? [])].map((id) => ({ id })),
        },
        roomId: room?.id,
        // Frozen at placement time (#375): renaming the room in 2027 must not
        // rewrite what the 2026 grid says.
        roomLabel: room?.name,
        startsAt: placedAt(session.start),
        endsAt: placedAt(session.end),
      },
    });
  }

  // The two talks created above get their slot too — one of them is the only
  // English quickie, and both are the ones the speaker-edit fixtures point at.
  const placements = [
    { slug: "kubernetes-en-production", room: "Amphithéâtre", start: "10:55", end: "11:35" },
    { slug: "react-server-components", room: "Pastel", start: "13:15", end: "13:35" },
  ];
  for (const placement of placements) {
    const room = roomsByName.get(placement.room);
    await prisma.talk.update({
      where: { editionId_slug: { editionId: edition.id, slug: placement.slug } },
      data: {
        roomId: room?.id,
        roomLabel: room?.name,
        startsAt: placedAt(placement.start),
        endsAt: placedAt(placement.end),
      },
    });
  }
  // The keynotes are talks, not bands (#456), and they are the reason relay
  // rooms exist: the amphitheatre seats 500 and the DevFest sells more than
  // that, so the opening plays on a screen in Agora 1 as well. Seeded here or
  // the case never appears in a development database — which is exactly how
  // eight rooms went unnoticed until #441.
  const keynotes = [
    { slug: "keynote-ouverture", title: "Keynote d'ouverture",
      description: "Dix ans de DevFest Toulouse, et ce que la décennie qui vient nous prépare.",
      speaker: speakerMarie.id, start: "08:00", end: "08:45",
      room: "Amphithéâtre", relays: ["Agora 1"] },
    { slug: "keynote-cloture", title: "Keynote de clôture",
      description: "Ce qu'on retient de la journée, et rendez-vous à la soirée.",
      speaker: speakerJean.id, start: "16:30", end: "17:15",
      room: "Amphithéâtre", relays: ["Agora 1", "Hémicycle"] },
  ];
  for (const keynote of keynotes) {
    const room = roomsByName.get(keynote.room);
    await prisma.talk.create({
      data: {
        slug: keynote.slug, title: keynote.title, description: keynote.description,
        format: "KEYNOTE", level: null, language: "fr",
        publicationStatus: "PUBLISHED", editionId: edition.id, categoryId: catCloud.id,
        speakers: { connect: [{ id: keynote.speaker }] },
        roomId: room?.id,
        roomLabel: room?.name,
        startsAt: placedAt(keynote.start),
        endsAt: placedAt(keynote.end),
        simulcasts: {
          create: keynote.relays.flatMap((name) => {
            const relay = roomsByName.get(name);
            // Frozen here too (#375), same reason as roomLabel above.
            return relay ? [{ roomId: relay.id, roomLabel: relay.name }] : [];
          }),
        },
      },
    });
  }

  console.log(`Talks created: ${sessions.length + 2 + keynotes.length}`);

  await assertNoRoomClash(edition.id);

  // Everything that is not a session. Lunch is the one that matters for the
  // grid: it spans every room, and in 2026 no quickie runs under it.
  await prisma.scheduleEntry.deleteMany({ where: { editionId: edition.id } });
  const scheduleEntries = [
    { kind: "OTHER" as const, labelFr: "Accueil et petit déjeuner", labelEn: "Welcome and breakfast", startsAt: "06:30", endsAt: "07:45" },
    { kind: "BREAK" as const, labelFr: "Pause du matin", labelEn: "Morning break", startsAt: "09:35", endsAt: "10:00" },
    { kind: "MEAL" as const, labelFr: "Déjeuner", labelEn: "Lunch", startsAt: "11:45", endsAt: "13:15" },
    { kind: "BREAK" as const, labelFr: "Pause de l'après-midi", labelEn: "Afternoon break", startsAt: "15:00", endsAt: "15:30" },
    { kind: "SOCIAL" as const, labelFr: "Soirée « 10 ans »", labelEn: "\"10 years\" party", startsAt: "17:30", endsAt: "20:00" },
  ];
  for (const entry of scheduleEntries) {
    await prisma.scheduleEntry.create({
      data: {
        editionId: edition.id,
        kind: entry.kind,
        labelFr: entry.labelFr,
        labelEn: entry.labelEn,
        startsAt: new Date(`2026-11-19T${entry.startsAt}:00Z`),
        endsAt: new Date(`2026-11-19T${entry.endsAt}:00Z`),
      },
    });
  }
  console.log(`Schedule entries created: ${scheduleEntries.length}`);

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
