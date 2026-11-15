// The edition and the tickets the arrivals e2e suite works on (#777): a few
// counters, tickets of every kind a scan can meet, badges already frozen. It
// writes straight to the database, so nothing here calls Billetweb: the
// edition is linked to no event, which is also what keeps the check-in job
// (lib/billetweb-checkin.ts) off the network.
//
//   docker exec devfest-local-backend pnpm exec tsx scripts/e2e-arrivals-fixture.ts setup
//   docker exec devfest-local-backend pnpm exec tsx scripts/e2e-arrivals-fixture.ts clean
//
// `setup` is idempotent: it puts the fixture back in its starting state, whatever
// the last run left (scans, moves, labels). `clean` removes the edition. Nothing
// else is touched: the 2026 edition and its imported attendees stay as they are.
import { PrismaPg } from "@prisma/adapter-pg";
import QRCode from "qrcode";

import { PrismaClient } from "../src/generated/prisma/client.js";

// Before the first real edition (getSeededEdition starts at 2016) and after the
// years the backend suites own (1500 to 2005, test-year-ownership.test.ts).
const FIXTURE_YEAR = 2007;

const MARKER = "E2E_FIXTURE_JSON=";

interface FixtureAttendee {
  key: string;
  firstName: string;
  lastName: string;
  company: string;
  tier: "normal" | "dedicated";
  number: number | null;
  isCancelled?: boolean;
  /** Already scanned at the entrance, 30 minutes ago. */
  isScanned?: boolean;
}

// One ticket per scenario: a scan changes the ticket it reads, so two tests
// never share one. Counters and bins count from 1, places from 00: 1101 is counter 1, bin 1, place 01.
const ATTENDEES: FixtureAttendee[] = [
  { key: "camera", firstName: "Camille", lastName: "Testcamera", company: "Atelier Test", tier: "normal", number: 1101 },
  { key: "search", firstName: "Dominique", lastName: "Testrecherche", company: "Atelier Test", tier: "normal", number: 2101 },
  { key: "counter", firstName: "Charlie", lastName: "Testguichet", company: "Atelier Test", tier: "normal", number: 1102 },
  { key: "cancelled", firstName: "Claude", lastName: "Testannule", company: "Atelier Test", tier: "normal", number: 1103, isCancelled: true },
  { key: "already", firstName: "Alex", lastName: "Testdejascanne", company: "Atelier Test", tier: "normal", number: 2102, isScanned: true },
  { key: "dedicated", firstName: "Sacha", lastName: "Testspeaker", company: "Atelier Test", tier: "dedicated", number: null },
  { key: "nobadge", firstName: "Nael", lastName: "Testsansbadge", company: "Atelier Test", tier: "normal", number: null },
  { key: "help", firstName: "Noa", lastName: "Testaide", company: "Atelier Test", tier: "normal", number: null },
  { key: "outage", firstName: "Olivia", lastName: "Testcoupure", company: "Atelier Test", tier: "normal", number: 1104 },
  { key: "layout", firstName: "Lou", lastName: "Testmiseenpage", company: "Atelier Test", tier: "normal", number: 1105 },
  { key: "undo", firstName: "Eden", lastName: "Testannulation", company: "Atelier Test", tier: "normal", number: 1106 },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function clean() {
  const edition = await prisma.edition.findUnique({ where: { year: FIXTURE_YEAR }, select: { id: true } });
  if (!edition) return;
  // Attendees go with the edition (cascade); the tiers do not.
  await prisma.attendee.deleteMany({ where: { editionId: edition.id } });
  await prisma.ticketTier.deleteMany({ where: { editionId: edition.id } });
  await prisma.edition.delete({ where: { id: edition.id } });
}

async function setup() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const layout = {
    badgeCounters: 2,
    badgeBinsPerCounter: 2,
    badgesPerBin: 99,
    badgesFrozenAt: new Date(now - day),
    // Open now, so a station link works: the default window needs an event date.
    stationAccessFrom: new Date(now - day),
    stationAccessUntil: new Date(now + 2 * day),
  };
  const edition = await prisma.edition.upsert({
    where: { year: FIXTURE_YEAR },
    update: layout,
    create: { year: FIXTURE_YEAR, ...layout },
    select: { id: true },
  });

  await prisma.attendee.deleteMany({ where: { editionId: edition.id } });
  const tiers = {
    normal: await prisma.ticketTier.upsert({
      where: { editionId_sortOrder: { editionId: edition.id, sortOrder: 1 } },
      update: { nameFr: "Participant test", isOutsideFlow: false, deletedAt: null },
      create: {
        editionId: edition.id,
        sortOrder: 1,
        nameFr: "Participant test",
        nameEn: "Test attendee",
        price: 0,
        billetwebTicketId: "e2e-normal",
      },
    }),
    dedicated: await prisma.ticketTier.upsert({
      where: { editionId_sortOrder: { editionId: edition.id, sortOrder: 2 } },
      update: { nameFr: "Speaker test", isOutsideFlow: true, deletedAt: null },
      create: {
        editionId: edition.id,
        sortOrder: 2,
        nameFr: "Speaker test",
        nameEn: "Test speaker",
        price: 0,
        billetwebTicketId: "e2e-dedicated",
        isOutsideFlow: true,
      },
    }),
  };

  const result: Record<string, unknown> = {};
  for (const [index, spec] of ATTENDEES.entries()) {
    const barcode = `77000000${String(index + 1).padStart(2, "0")}`;
    const tier = tiers[spec.tier];
    const scannedAt = spec.isScanned ? new Date(now - 30 * 60 * 1000) : null;
    const row = await prisma.attendee.create({
      data: {
        editionId: edition.id,
        billetwebId: `e2e-${index + 1}`,
        barcode,
        firstName: spec.firstName,
        lastName: spec.lastName,
        company: spec.company,
        billetwebTicketId: tier.billetwebTicketId!,
        ticketTierId: tier.id,
        orderId: `e2e-order-${index + 1}`,
        orderDate: new Date(now - 7 * day),
        isCancelled: spec.isCancelled ?? false,
        badgeNumber: spec.number,
        scannedAt,
        scannedByLabel: scannedAt ? "Poste Scan" : null,
      },
      select: { id: true },
    });
    result[spec.key] = {
      id: row.id,
      barcode,
      firstName: spec.firstName,
      lastName: spec.lastName,
      number: spec.number,
      // What the phone's camera is shown: the ticket's QR code.
      qr: await QRCode.toDataURL(barcode, { margin: 4, scale: 8, errorCorrectionLevel: "M" }),
    };
  }
  process.stdout.write(`${MARKER}${JSON.stringify({ editionId: edition.id, year: FIXTURE_YEAR, attendees: result })}\n`);
}

const command = process.argv[2];
try {
  if (command === "setup") await setup();
  else if (command === "clean") await clean();
  else {
    process.stderr.write("usage: e2e-arrivals-fixture.ts setup|clean\n");
    process.exitCode = 2;
  }
} finally {
  await prisma.$disconnect();
}
