import { request, type FullConfig } from "@playwright/test";

import { ATTENDEE_KEYS, saveData, type AttendeeKey, type FixtureAttendee } from "./support/data";
import { isBackendUp, runFixture } from "./support/backend";

// Before the first test (#777): the fixture edition put back in its starting
// state, the links of its stations read as an admin does (the real path, not a
// token rebuilt here), and the pages compiled once so no test pays for `next dev`.

const FIXTURE_MARKER = "E2E_FIXTURE_JSON=";
// Local demo account (docs/comptes-dev-local.md).
const ADMIN = { email: "admin@devfesttoulouse.fr", password: "admin1234!dev" };
const WARM_UP_PATHS = ["/arrivees/poste/warm-up", "/arrivees/scan", "/arrivees/aide", "/arrivees/guichet/1"];

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;

  if (!(await isBackendUp())) {
    throw new Error("The backend does not answer on localhost:4000: start the local stack (docker compose -f docker-compose.local.yml up -d).");
  }

  const output = runFixture("setup");
  const line = output.split("\n").find((l) => l.startsWith(FIXTURE_MARKER));
  if (!line) throw new Error(`The fixture script gave no data:\n${output}`);
  const fixture = JSON.parse(line.slice(FIXTURE_MARKER.length)) as {
    editionId: number;
    attendees: Record<AttendeeKey, FixtureAttendee>;
  };
  for (const key of ATTENDEE_KEYS) {
    if (!fixture.attendees[key]) throw new Error(`The fixture has no "${key}" ticket`);
  }

  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const signIn = await api.post("/api/auth/sign-in/email", { data: ADMIN });
  if (!signIn.ok()) throw new Error(`Admin sign-in refused (${signIn.status()}): is the local demo data seeded?`);
  const described = await api.get(`/api/admin/arrivals-stations/${fixture.editionId}`);
  if (!described.ok()) throw new Error(`The station links were refused (${described.status()})`);
  const { stations } = (await described.json()) as { stations: Array<{ code: string; url: string }> };
  await api.dispose();

  const web = await request.newContext({ baseURL });
  for (const path of WARM_UP_PATHS) await web.get(path, { timeout: 120_000 });
  await web.dispose();

  saveData({
    editionId: fixture.editionId,
    attendees: fixture.attendees,
    stations: Object.fromEntries(stations.map((s) => [s.code, s.url])),
  });
}
