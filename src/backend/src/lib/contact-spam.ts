import { prisma } from "./prisma.js";

// Suspicion score of a contact message (#767). Local rules only: no message
// leaves the server to be judged. The phishing it targets fills the form
// cleanly (the honeypot never fires), poses as a sponsor prospect, and links
// to a "dossier" on a cheap domain — so the signals are about links and about
// who sends, not about the form being filled badly.
//
// Reasons are codes, never text typed by the visitor: they land in the history
// (lib/audit.ts), where the message fields themselves are masked.

export const DEFAULT_SPAM_THRESHOLD = 3;

// Our own domain always passes; the admin adds partners' domains in settings.
const ALWAYS_ALLOWED_DOMAINS = ["devfesttoulouse.fr"];

// Extensions that cost next to nothing and carry most throwaway phishing
// domains. A legitimate sender on one of them still passes on that alone.
const RISKY_TLDS = [".online", ".top", ".xyz", ".click", ".shop", ".site", ".live", ".icu", ".buzz", ".rest"];

// A short local list: the aim is the common throwaway inboxes, not coverage.
const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "yopmail.com",
  "yopmail.fr",
  "guerrillamail.com",
  "sharklasers.com",
  "10minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "dispostable.com",
];

// The phishing reuses our own meta description (src/frontend/messages/fr.json,
// `metadata.description`), copied here because the backend container does not
// see the frontend. Accent-free, each entry one idea: four ideas or more in a
// message means it was written from our pitch.
const SITE_PITCH_WORDS = [
  ["conference", "conferences"],
  ["web"],
  ["cloud"],
  ["ia"],
  ["securite"],
  ["developpeur", "developpeurs", "developpeuses"],
];
const SITE_PITCH_MIN_WORDS = 4;

// In a name, a bare domain only counts with an extension people actually click:
// "St.Clair" is a name, "bit.ly" is not.
const LINK_TLDS = [".com", ".net", ".org", ".fr", ".io", ".co", ".info", ".biz", ".me", ".ly", ".link", ".app", ".dev", ".eu", ".ru", ".cn"];

const WEIGHT = { externalLink: 2, riskyTld: 2, disposableEmail: 2, sitePitch: 1 } as const;

export interface SpamInput {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  jobTitle?: string;
  message: string;
}

export interface SpamConfig {
  threshold: number;
  allowedDomains: string[];
}

export interface SpamVerdict {
  score: number;
  reasons: string[];
  isSuspicious: boolean;
}

// An explicit link: a scheme or `www.`. Used everywhere.
const EXPLICIT_LINK = /\b(?:https?:\/\/|www\.)([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;
// A bare domain such as `partagepro.online`. Only trusted where a dot followed
// by letters has no business, or with a risky extension: in free text,
// "fin.Merci" or an e-mail address would otherwise count as links.
const BARE_DOMAIN = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/gi;
const EMAIL_ADDRESS = /[^\s@]+@[^\s@]+/g;

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function explicitLinkHosts(text: string): string[] {
  return [...text.matchAll(EXPLICIT_LINK)].map((m) => m[1].toLowerCase());
}

function bareDomains(text: string): string[] {
  return [...text.replace(EMAIL_ADDRESS, " ").matchAll(BARE_DOMAIN)].map((m) => m[1].toLowerCase());
}

function riskyTld(host: string): string | undefined {
  return RISKY_TLDS.find((tld) => host.endsWith(tld));
}

function isAllowed(host: string, allowedDomains: string[]): boolean {
  return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function hasLink(text: string | undefined, { bare }: { bare: boolean }): boolean {
  if (!text) return false;
  if (explicitLinkHosts(text).length > 0) return true;
  return bare && bareDomains(text).some((host) => riskyTld(host) || LINK_TLDS.some((tld) => host.endsWith(tld)));
}

function reusesSitePitch(message: string): boolean {
  const words = new Set(normalize(message).split(/[^a-z0-9]+/));
  const found = SITE_PITCH_WORDS.filter((variants) => variants.some((w) => words.has(w)));
  return found.length >= SITE_PITCH_MIN_WORDS;
}

export function scoreContactMessage(input: SpamInput, config: SpamConfig): SpamVerdict {
  const allowedDomains = [...ALWAYS_ALLOWED_DOMAINS, ...config.allowedDomains];
  const reasons: string[] = [];
  let score = 0;

  // A link where a name goes is never legitimate, and it is what turns the
  // confirmation e-mail into a phishing relay: quarantined on its own. Names
  // never hold a domain; a company may well be called "Foo.io", so there only
  // an explicit link counts.
  const identityHasLink =
    hasLink(input.firstName, { bare: true }) ||
    hasLink(input.lastName, { bare: true }) ||
    hasLink(input.company, { bare: false }) ||
    hasLink(input.jobTitle, { bare: false });
  if (identityHasLink) {
    score += config.threshold;
    reasons.push("link_in_identity");
  }

  const messageHosts = [
    ...explicitLinkHosts(input.message),
    ...bareDomains(input.message).filter((host) => riskyTld(host)),
  ];
  if (messageHosts.some((host) => !isAllowed(host, allowedDomains))) {
    score += WEIGHT.externalLink;
    reasons.push("external_link");
  }

  const emailDomain = input.email.split("@").pop()?.toLowerCase() ?? "";
  const tld = [...messageHosts, emailDomain].map(riskyTld).find(Boolean);
  if (tld) {
    score += WEIGHT.riskyTld;
    reasons.push(`risky_tld:${tld}`);
  }

  if (DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    score += WEIGHT.disposableEmail;
    reasons.push("disposable_email");
  }

  if (reusesSitePitch(input.message)) {
    score += WEIGHT.sitePitch;
    reasons.push("site_pitch");
  }

  return { score, reasons, isSuspicious: score >= config.threshold };
}

// Settings are free strings (routes/admin/settings.ts): a value that does not
// parse falls back to the default rather than switching the filter off.
export async function loadSpamConfig(): Promise<SpamConfig> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ["contact_spam_threshold", "contact_spam_allowed_domains"] } },
  });
  const value = (key: string) => rows.find((r) => r.key === key)?.value ?? "";

  const threshold = Number.parseInt(value("contact_spam_threshold"), 10);
  const allowedDomains = value("contact_spam_allowed_domains")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
    .filter(Boolean);

  return {
    threshold: Number.isInteger(threshold) && threshold > 0 ? threshold : DEFAULT_SPAM_THRESHOLD,
    allowedDomains,
  };
}
