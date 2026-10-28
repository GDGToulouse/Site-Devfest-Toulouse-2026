// Fills the hidden Billetweb test event with fake attendees, so the arrivals
// screens (#638-#644) can be tried end to end without real personal data and
// without writing to the real event. The test event is hard-coded on purpose:
// the API key in use can also write to the real DevFest event.
//
// Dry run by default; `--apply` writes. Run inside the backend container:
//   docker exec devfest-local-backend pnpm exec tsx scripts/seed-billetweb-test-event.ts [--apply]
const TEST_EVENT_ID = "1492811";
const API = "https://www.billetweb.fr/api";
const BATCH_SIZE = 100;
const SEED = 2026;

// The real 2026 event's tiers (name, price, visibility), read on 2026-10-28. Copied
// rather than fetched: the key that writes here is restricted to the test event.
// `count` is how many tickets the test event gets: about 1,500 attendees, ~1,200
// of them through the badge desks and the rest in the dedicated flow (spec, "Volumes").
const TIERS = [
  { name: "Blind Bird", price: 45, visibility: 0, count: 30 },
  { name: "Early Bird", price: 67.5, visibility: 0, count: 50 },
  { name: "Early Bird - Cloud Toulouse", price: 60, visibility: 3, count: 18 },
  { name: "Last Bird", price: 90, visibility: 4, count: 180 },
  { name: "Normal", price: 90, visibility: 0, count: 900 },
  { name: "Sponsor et partenaire", price: 0, visibility: 3, count: 90 },
  { name: "Prévente Sponsor", price: 0, visibility: 3, count: 30 },
  { name: "Bon de Commande", price: 0, visibility: 3, count: 20 },
  { name: "Speaker", price: 0, visibility: 3, count: 70 },
  { name: "Bénévole", price: 0, visibility: 4, count: 40 },
  { name: "Staff", price: 0, visibility: 4, count: 30 },
  { name: "Prestataire", price: 0, visibility: 3, count: 10 },
  { name: "Invitation Cloud Toulouse", price: 0, visibility: 3, count: 15 },
  { name: "Invitation Communauté", price: 0, visibility: 3, count: 20 },
];

// Edge cases from the spec: homonyms, accents, hyphens, apostrophes, long names.
const FIRST_NAMES = [
  "Camille", "Léa", "Hugo", "Lucas", "Chloé", "Inès", "Noé", "Zoé", "Théo", "Manon",
  "Jean-Baptiste", "Marie-Hélène", "Anaïs", "Gaëlle", "Loïc", "Élodie", "Raphaël", "Maël",
  "Sébastien", "Aurélie", "Kévin", "Céline", "Jérôme", "Hélène", "Thibault", "Océane",
  "Nicolas", "Julie", "Mathieu", "Sarah", "Yanis", "Fatoumata", "Nguyen", "Wei", "Aleksandr",
  "Antoine", "Pauline", "Romain", "Laura", "Maxime", "Émilie", "Quentin", "Justine", "Adrien",
  "Mélanie", "Guillaume", "Margaux", "Florian", "Clémence", "Bastien", "Ophélie", "Damien",
  "Lucie", "Arnaud", "Amandine", "Valentin", "Lionel", "Samia", "Karim", "Aïcha", "Mohamed",
];
const LAST_NAMES = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy",
  "Moreau", "Simon", "Laurent", "Lefèvre", "Michel", "Garcia", "Fournier", "Rousseau",
  "Bonnet", "Mercier", "Lambert", "Faure", "Girard", "André", "Gauthier", "Müller",
  "D'Artagnan", "N'Diaye", "Saint-Exupéry", "de La Fontaine", "Ó Súilleabháin",
  "Vandenberghe-Delacroix-Montmorency", "Lê", "Nguyễn", "Øster", "Castañeda",
  "Roux", "Vincent", "Fontaine", "Chevalier", "Robin", "Masson", "Sanchez", "Muller", "Lefebvre",
  "Henry", "Perrin", "Morin", "Mathieu", "Clément", "Gautier", "Dumont", "Lopez", "Blanc",
  "Guérin", "Boyer", "Garnier", "Chevallier", "François", "Legrand", "Gaillard", "Barbier",
  "Arnaud", "Martinez", "Rolland", "Renaud", "Picard", "Aubert", "Lemaire", "Dupuis", "Brun",
];
// Real events have a handful of exact homonyms (3 groups among 529 tickets in 2026).
const HOMONYM_COUNT = 8;

type Ticket = { id: string; name: string };

const user = process.env.BILLETWEB_USER;
const key = process.env.BILLETWEB_KEY;
if (!user || !key) {
  process.stderr.write("BILLETWEB_USER and BILLETWEB_KEY are required\n");
  process.exit(2);
}
const isApply = process.argv.includes("--apply");
const auth = `user=${encodeURIComponent(user)}&key=${encodeURIComponent(key)}&version=1`;

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  // Second line of defence: nothing but the test event is ever written.
  if (method === "POST" && !path.startsWith(`event/${TEST_EVENT_ID}/`)) {
    throw new Error(`refusing to write outside the test event: ${path}`);
  }
  const res = await fetch(`${API}/${path}?${auth}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || (json && typeof json === "object" && "error" in json)) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

// Deterministic, so a rerun on an emptied event gives the same people.
let state = SEED;
function random(): number {
  state = (state * 1103515245 + 12345) % 2 ** 31;
  return state / 2 ** 31;
}
const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)];

const [testTickets, testAttendees] = (await Promise.all([
  call("GET", `event/${TEST_EVENT_ID}/tickets`),
  call("GET", `event/${TEST_EVENT_ID}/attendees`),
])) as [Ticket[], unknown[]];

if (testAttendees.length > 0) {
  process.stderr.write(`The test event already has ${testAttendees.length} attendees: empty it first.\n`);
  process.exit(1);
}

// 1. Tiers: same names, prices and visibility as the real event, in its order.
const missing = TIERS.filter((s) => !testTickets.some((t) => t.name === s.name));
process.stdout.write(`Tiers to create in the test event: ${missing.length}\n`);
if (isApply && missing.length > 0) {
  await call("POST", `event/${TEST_EVENT_ID}/tickets_update`, {
    data: missing.map(({ name, price, visibility }) => ({ id: 0, name, price, visibility })),
  });
}
const created = isApply ? ((await call("GET", `event/${TEST_EVENT_ID}/tickets`)) as Ticket[]) : [];
const tiers = TIERS.map((tier) => ({
  ...tier,
  id: created.find((t) => t.name === tier.name)?.id ?? `(${tier.name})`,
}));

// 2. Orders: mostly one ticket, some groups of 2 to 5 bought by one person.
// Full names drawn without replacement, then a few deliberate homonyms.
const fullNames = FIRST_NAMES.flatMap((firstname) => LAST_NAMES.map((name) => ({ firstname, name })));
const people: Array<{ ticket: string; firstname: string; name: string }> = [];
for (const tier of tiers) {
  for (let i = 0; i < tier.count; i++) {
    const [person] = fullNames.splice(Math.floor(random() * fullNames.length), 1);
    people.push({ ticket: tier.id, ...person });
  }
}
for (let i = 0; i < HOMONYM_COUNT; i++) {
  const twin = pick(people);
  const other = pick(people);
  other.firstname = twin.firstname;
  other.name = twin.name;
}
const orders: Array<Record<string, unknown>> = [];
for (let i = 0; i < people.length; ) {
  const size = random() < 0.1 ? 2 + Math.floor(random() * 4) : 1;
  const group = people.slice(i, i + size);
  const buyer = group[0];
  orders.push({
    firstname: buyer.firstname,
    name: buyer.name,
    email: `participant-${orders.length + 1}@example.com`,
    payment_type: "other",
    request_id: `test-${orders.length + 1}`,
    // No `ship`: Billetweb must not e-mail anyone.
    products: group.map((p, j) => ({
      ticket: p.ticket,
      firstname: p.firstname,
      name: p.name,
      email: `participant-${orders.length + 1}-${j + 1}@example.com`,
    })),
  });
  i += size;
}
const homonyms = people.length - new Set(people.map((p) => `${p.firstname} ${p.name}`)).size;
process.stdout.write(`Attendees: ${people.length} in ${orders.length} orders, ${homonyms} sharing a full name\n`);
for (const tier of tiers) {
  process.stdout.write(`  ${tier.name}: ${tier.count}\n`);
}

if (!isApply) {
  process.stdout.write("Dry run: nothing written. Rerun with --apply.\n");
  process.exit(0);
}

// One order first: proves an offline event accepts offline orders before the rest go.
await call("POST", `event/${TEST_EVENT_ID}/add_order`, { data: orders.slice(0, 1) });
process.stdout.write("First order accepted.\n");
for (let i = 1; i < orders.length; i += BATCH_SIZE) {
  await call("POST", `event/${TEST_EVENT_ID}/add_order`, { data: orders.slice(i, i + BATCH_SIZE) });
  process.stdout.write(`  orders ${i + 1}-${Math.min(i + BATCH_SIZE, orders.length)} added\n`);
  await new Promise((r) => setTimeout(r, 1000));
}
process.stdout.write("Done.\n");
