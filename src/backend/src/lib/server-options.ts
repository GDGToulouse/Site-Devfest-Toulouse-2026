import { BlockList, isIP } from "node:net";

import type { FastifyServerOptions } from "fastify";

/**
 * Ceiling on a single route parameter, in characters (#467).
 *
 * Fastify defaults to 100 and answers `414 URI Too Long` above it — before the
 * handler runs, so no route can opt out. Six conference pages hit that in
 * production: slugs are derived from talk titles, and the historical import
 * produced titles long enough to reach 168 characters. The frontend correctly
 * refuses to read a 414 as "not found" (#345), so those pages rendered a 500,
 * and the sitemap kept feeding them to Google.
 *
 * 512 is three times the longest slug in the data. Not unbounded: the value
 * exists to bound the router's work, and a slug that long is a data problem
 * worth surfacing rather than serving.
 */
export const MAX_PARAM_LENGTH = 512;

// Where a reverse proxy of ours can sit: the Docker network the containers share,
// or the loopback. A peer outside it is a visitor, whatever it claims.
const PROXY_NETWORKS = new BlockList();
for (const [net, prefix] of [["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["127.0.0.0", 8], ["169.254.0.0", 16]] as const) {
  PROXY_NETWORKS.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [["fc00::", 7], ["fe80::", 10]] as const) PROXY_NETWORKS.addSubnet(net, prefix, "ipv6");
PROXY_NETWORKS.addAddress("::1", "ipv6");

function isProxyAddress(address: string): boolean {
  // A dual-stack socket reports an IPv4 peer as ::ffff:172.18.0.5.
  const mapped = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  const family = isIP(mapped);
  return family !== 0 && PROXY_NETWORKS.check(mapped, family === 4 ? "ipv4" : "ipv6");
}

/**
 * How many reverse proxies stand between the visitor and this server (#663),
 * read from `TRUST_PROXY_HOPS`. Fastify then takes `request.ip` from
 * `X-Forwarded-For` counting that many entries back from the socket, so what a
 * visitor writes in the header, further left, never counts. `trustProxy: true`
 * believed the leftmost entry: the visitor picked the address the rate limit
 * counted and the logs recorded.
 *
 * Fastify's own numeric `trustProxy` is no way to say it: since 5.x it trusts
 * nothing for a bare hop count (a direct client could otherwise supply enough
 * hops itself), so the count goes into a function. A hop only counts when it is
 * an address of ours (private network, loopback): a public peer cannot be the
 * proxy, and a client reaching the server directly stays itself.
 *
 * Deployed, the chain is Traefik, then the Next.js frontend, then this server:
 * Traefik replaces the header with the visitor's address, Next passes it on
 * unchanged (its rewrite proxy adds nothing), so the one trusted hop is the
 * frontend, whose container address is the socket. Hence 1 in the production
 * and dev composes. Locally nothing sets the header, so 0.
 *
 * Unset or 0 trusts nobody (`request.ip` is the socket): a missing variable
 * merges visitors into one rate-limit bucket, which is seen at once, instead of
 * letting them choose their address, which is not. Anything else than a
 * non-negative integer stops the boot rather than guess how far to trust.
 */
export function trustProxyHops(raw: string | undefined): false | ((address: string, hop: number) => boolean) {
  if (raw === undefined || raw.trim() === "") return false;
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`TRUST_PROXY_HOPS must be a whole number of proxies (0, 1, 2…), got "${raw}"`);
  }
  const hops = Number(raw.trim());
  if (hops === 0) return false;
  return (address, hop) => hop < hops && isProxyAddress(address);
}

/**
 * Options shared by the real server and by the tests that probe its routing.
 *
 * `logger` is deliberately absent: the server configures its own level, and
 * tests want silence.
 *
 * trustProxy: see `trustProxyHops`.
 */
export const serverOptions: FastifyServerOptions = {
  trustProxy: trustProxyHops(process.env.TRUST_PROXY_HOPS),
  // Under `routerOptions`, not at the top level: Fastify 5 accepts both but
  // warns FSTDEP022 on the flat form, which it drops in 6.
  routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
};
