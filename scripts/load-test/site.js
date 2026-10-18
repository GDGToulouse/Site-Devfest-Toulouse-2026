// Load test of the public site (#690): how many simultaneous visitors the
// stack holds before pages slow down or fail, and which layer gives first.
//
// Run against beta, never prod: beta shares the VPS with prod, so run
// watch-prod.sh alongside and let it stop the test if prod slows down.
//
//   k6 run scripts/load-test/site.js                     # smoke: 2 visitors
//   PROFILE=steps k6 run scripts/load-test/site.js       # 50 → 100 → 200 → 400
//   BASE_URL=https://dev-j.site.devfesttoulouse.fr k6 run scripts/load-test/site.js
//
// All traffic comes from one IP. Browser API calls (`/api/*` relayed by the
// frontend) are limited to 200 per minute per IP, so they are measured in
// their own `api` scenario and kept out of the page thresholds: a 429 there
// measures the limit, not the site. Pages and their images are not limited
// per visitor.

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "https://beta.site.devfesttoulouse.fr").replace(/\/$/, "");
const PROFILE = __ENV.PROFILE || "smoke";

if (/^https?:\/\/(www\.)?devfesttoulouse\.fr$/.test(BASE_URL)) {
  throw new Error("Refusing to load-test production: point BASE_URL at beta or dev-j.");
}

const PAGE_STAGES = {
  smoke: [
    { duration: "15s", target: 2 },
    { duration: "30s", target: 2 },
  ],
  // Thirty seconds to reach each step, two minutes on it: long enough for the
  // page cache to settle and for a queue to build up if a layer saturates.
  steps: [
    { duration: "30s", target: 50 },
    { duration: "2m", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "2m", target: 100 },
    { duration: "30s", target: 200 },
    { duration: "2m", target: 200 },
    { duration: "30s", target: 400 },
    { duration: "2m", target: 400 },
    { duration: "30s", target: 0 },
  ],
};

if (!PAGE_STAGES[PROFILE]) {
  throw new Error(`Unknown PROFILE "${PROFILE}" (expected: ${Object.keys(PAGE_STAGES).join(", ")}).`);
}

const statusByType = new Counter("status_by_type");

export const options = {
  scenarios: {
    pages: {
      executor: "ramping-vus",
      exec: "visitor",
      startVUs: 0,
      stages: PAGE_STAGES[PROFILE],
      gracefulRampDown: "20s",
    },
    // A steady trickle of browser API calls (session feedback), well under the
    // per-IP budget, to see whether the backend slows down under page load.
    api: {
      executor: "constant-arrival-rate",
      exec: "apiCalls",
      rate: 1,
      timeUnit: "1s",
      duration: PROFILE === "smoke" ? "45s" : "12m",
      preAllocatedVUs: 5,
    },
  },
  thresholds: {
    // Stop at the first step where pages break or crawl: that step is the
    // answer, and going further only loads the shared VPS for nothing.
    "http_req_failed{type:page}": [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "30s" }],
    "http_req_duration{type:page}": [{ threshold: "p(95)<4000", abortOnFail: true, delayAbortEval: "30s" }],
    "http_req_failed{type:image}": ["rate<0.05"],
    "http_req_duration{type:api}": ["p(95)<1500"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

function slugsFrom(path, prefix) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { type: "setup" } });
  const pattern = new RegExp(`href="(${prefix}/[a-z0-9-]+)"`, "g");
  return [...new Set([...res.body.matchAll(pattern)].map((m) => m[1]))].slice(0, 30);
}

export function setup() {
  const data = {
    conferences: slugsFrom("/fr/conferences", "/fr/conferences"),
    speakers: slugsFrom("/fr/speakers", "/fr/speakers"),
  };
  if (data.conferences.length === 0 || data.speakers.length === 0) {
    throw new Error(`No conference or speaker found on ${BASE_URL}: is the site up and seeded?`);
  }
  return data;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function record(res, type) {
  const bucket = res.status >= 500 ? "5xx" : res.status === 429 ? "429" : res.status >= 400 ? "4xx" : "ok";
  statusByType.add(1, { type, bucket });
}

// Fetch a page, then a few of the images it embeds, as a browser would.
function page(path, name) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { type: "page", name } });
  record(res, "page");
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  if (res.status !== 200) return;

  const images = [...new Set([...res.body.matchAll(/src="(\/_next\/image\?[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))].slice(0, 4);
  if (images.length === 0) return;
  const responses = http.batch(images.map((src) => ["GET", `${BASE_URL}${src}`, null, { tags: { type: "image", name: "_next/image" } }]));
  responses.forEach((r) => record(r, "image"));
}

// One visitor's journey on the event day: home, programme, a session, its
// speaker, the sponsors — with reading time in between.
export function visitor(data) {
  page("/fr", "home");
  sleep(1 + Math.random() * 2);
  page("/fr/programme", "programme");
  sleep(2 + Math.random() * 3);
  page(pick(data.conferences), "conference");
  sleep(2 + Math.random() * 3);
  page(pick(data.speakers), "speaker");
  sleep(1 + Math.random() * 2);
  page("/fr/sponsors", "sponsors");
  sleep(1 + Math.random() * 2);
}

export function apiCalls(data) {
  const slug = pick(data.conferences).split("/").pop();
  const res = http.get(`${BASE_URL}/api/talks/${slug}/feedback`, { tags: { type: "api", name: "talk-feedback" } });
  record(res, "api");
}
