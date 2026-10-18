import { prisma } from "./prisma.js";

// The brochure form (#662) mails a confirmation to the address it is given,
// without checking that its owner asked. Two caps keep it from being used to
// flood a stranger's inbox. The route-level limit (5 requests per 15 minutes per
// IP, every category) stays as it was; these two only apply to the brochure.

const HOUR_MS = 60 * 60 * 1000;

/** Brochure requests one IP may make per hour. */
export const BROCHURE_IP_MAX = 3;

/** Mails one address may be sent per hour, brochure category only. */
export const BROCHURE_ADDRESS_WINDOW_MS = HOUR_MS;

// Per IP: in memory, like the rate limit plugin's own store. The backend runs
// one replica (architecture.md) and a restart resets every limit of the site
// alike, so a table would add a migration and a write per request for nothing.
// A fixed window per IP: the count starts at its first request.
const ipWindows = new Map<string, { count: number; resetAt: number }>();
const MAX_TRACKED_IPS = 10_000;

/**
 * Spend one of the IP's brochure requests for the hour. False when the budget
 * is used up: the caller refuses the request.
 */
export function consumeBrochureIpBudget(ip: string, now: number = Date.now()): boolean {
  const window = ipWindows.get(ip);
  if (!window || window.resetAt <= now) {
    if (ipWindows.size >= MAX_TRACKED_IPS) {
      // Expired windows first; if the map is still full of live ones, the
      // oldest goes (insertion order), so memory stays bounded under a flood.
      for (const [key, value] of ipWindows) if (value.resetAt <= now) ipWindows.delete(key);
      if (ipWindows.size >= MAX_TRACKED_IPS) ipWindows.delete(ipWindows.keys().next().value as string);
    }
    ipWindows.set(ip, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (window.count >= BROCHURE_IP_MAX) return false;
  window.count += 1;
  return true;
}

/** Seconds until the IP's budget is back, for `Retry-After`. */
export function brochureIpRetryAfter(ip: string, now: number = Date.now()): number {
  const window = ipWindows.get(ip);
  return window ? Math.max(1, Math.ceil((window.resetAt - now) / 1000)) : 1;
}

/** One address, one spelling: case does not make a new recipient. */
export function normalizeAddress(email: string): string {
  return email.trim().toLowerCase();
}

// Addresses being handled right now. The database check below runs before the
// message is stored: two requests arriving together would both pass it. This
// set is checked and filled with no await in between, so the second one sees
// the first.
const inFlight = new Set<string>();

/**
 * Take the address for the duration of one request. Null when another request
 * for it is running. Call the returned function once the message is stored (or
 * the request abandoned).
 */
export function claimAddress(email: string): (() => void) | null {
  const key = normalizeAddress(email);
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  return () => {
    inFlight.delete(key);
  };
}

/** True when this address already had a brochure request stored within the hour. */
export async function hasRecentBrochureRequest(categoryId: number, email: string, now: number = Date.now()): Promise<boolean> {
  const recent = await prisma.contactMessage.findFirst({
    where: {
      categoryId,
      email: { equals: normalizeAddress(email), mode: "insensitive" },
      createdAt: { gte: new Date(now - BROCHURE_ADDRESS_WINDOW_MS) },
    },
    select: { id: true },
  });
  return recent !== null;
}
